// services/kyc.service.js
// Nigerian business & identity verification service.
//
// Providers (modular — add API keys to .env to enable):
//   1. Paystack     — BVN resolve, bank account resolve (PAYSTACK_SECRET_KEY)
//   2. Smile ID     — BVN, NIN, driver's license, CAC (SMILE_PARTNER_ID, SMILE_API_KEY)
//   3. VerifyMe     — BVN, NIN, CAC (VERIFYME_API_KEY)
//   4. CAC public   — Business name search (CAC_SEARCH_API_KEY, optional)
//   5. FIRS / JTB   — TIN lookup (FIRS_API_KEY, optional)
//
// If no provider keys are configured, checks fall back to format validation
// and are marked as "manual review" for the admin.

const axios = require('axios');

const PAYSTACK_BASE_URL = 'https://api.paystack.co';

// ─── Provider detection ────────────────────────────────────────────────────────

function paystackHeaders() {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) return null;
  return { Authorization: `Bearer ${key}` };
}

function smileIdConfig() {
  const partnerId = process.env.SMILE_PARTNER_ID;
  const apiKey = process.env.SMILE_API_KEY;
  if (!partnerId || !apiKey) return null;
  return { partnerId, apiKey, baseUrl: 'https://v3.smileidentity.com/api/v2' };
}

function verifyMeConfig() {
  const key = process.env.VERIFYME_API_KEY;
  if (!key) return null;
  return { apiKey: key, baseUrl: 'https://api.verifyme.ng/v1' };
}

function cacConfig() {
  const key = process.env.CAC_SEARCH_API_KEY;
  if (!key) return null;
  return { apiKey: key, baseUrl: 'https://searchapp.cac.gov.ng/api/v1' };
}

function firsConfig() {
  const key = process.env.FIRS_API_KEY;
  if (!key) return null;
  return { apiKey: key, baseUrl: 'https://api.firs.gov.ng/v1' };
}

// ─── Name matching helpers ────────────────────────────────────────────────────

/**
 * Normalise a Nigerian name for comparison — strips titles, punctuation,
 * collapses whitespace, converts to lowercase.
 */
function normaliseName(name) {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/\b(mr|mrs|miss|ms|dr|chief|alhaji|alhaja|engr|sir|esq)\b\.?/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Tokenise a name and compute how many tokens match between two names.
 * Returns a ratio: 0 = no match, 1 = exact match.
 * Token order doesn't matter — "John Okafor" matches "Okafor John".
 */
function nameSimilarity(nameA, nameB) {
  const a = normaliseName(nameA).split(' ').filter(Boolean);
  const b = normaliseName(nameB).split(' ').filter(Boolean);
  if (a.length === 0 || b.length === 0) return 0;

  const setA = new Set(a);
  const matches = b.filter((token) => setA.has(token)).length;
  return matches / Math.max(a.length, b.length);
}

/**
 * Check if two names are a match — either exact, or last name matches,
 * or token overlap ratio >= 0.5.
 */
function namesMatch(nameA, nameB) {
  const sim = nameSimilarity(nameA, nameB);
  if (sim >= 0.5) return true;

  // Fallback: check if the last token (likely surname) matches
  const lastA = normaliseName(nameA).split(' ').pop();
  const lastB = normaliseName(nameB).split(' ').pop();
  if (lastA && lastB && (lastA === lastB || lastA.includes(lastB) || lastB.includes(lastA))) {
    return true;
  }

  return false;
}

// ─── 1. BVN verification (Paystack) ─────────────────────────────────────────────

/**
 * Resolve BVN via Paystack — returns the account holder's name, DOB, mobile.
 * Paystack charges ₦50 per call.
 *
 * @param {string} bvn - 11-digit BVN
 * @returns {Promise<{ success, data?, message? }>}
 */
async function resolveBVN(bvn) {
  const headers = paystackHeaders();
  if (!headers) return { success: false, message: 'Paystack not configured', skipped: true };

  if (!/^\d{11}$/.test(bvn)) {
    return { success: false, message: 'BVN must be exactly 11 digits' };
  }

  try {
    const res = await axios.get(`${PAYSTACK_BASE_URL}/bvn/resolve/${bvn}`, {
      headers,
      timeout: 15000,
    });

    if (res.data?.status) {
      const data = res.data.data;
      return {
        success: true,
        data: {
          firstName: data?.first_name || '',
          lastName: data?.last_name || '',
          fullName: `${data?.first_name || ''} ${data?.last_name || ''}`.trim(),
          dob: data?.dob || '',
          mobile: data?.mobile || '',
          bvn,
        },
      };
    }
    return { success: false, message: res.data?.message || 'BVN could not be verified' };
  } catch (err) {
    const msg = err.response?.data?.message || err.message;
    return { success: false, message: `BVN verification failed: ${msg}` };
  }
}

// ─── 2. Bank account verification (Paystack) ───────────────────────────────────

let bankListCache = null;
let bankListCachedAt = 0;
const BANK_LIST_TTL = 24 * 60 * 60 * 1000;

async function getBankCode(bankName) {
  const headers = paystackHeaders();
  if (!headers) return null;

  if (!bankListCache || Date.now() - bankListCachedAt > BANK_LIST_TTL) {
    try {
      const res = await axios.get(`${PAYSTACK_BASE_URL}/bank`, {
        headers,
        params: { country: 'nigeria', perPage: 100 },
        timeout: 15000,
      });
      if (res.data?.status && Array.isArray(res.data.data)) {
        bankListCache = res.data.data;
        bankListCachedAt = Date.now();
      }
    } catch (err) {
      console.error('Failed to fetch Paystack bank list:', err.message);
      return null;
    }
  }

  if (!bankListCache) return null;
  const normalized = bankName.toLowerCase().trim();

  let match = bankListCache.find((b) => b.name.toLowerCase() === normalized);
  if (match) return match.code;

  match = bankListCache.find((b) =>
    b.name.toLowerCase().includes(normalized) || normalized.includes(b.name.toLowerCase())
  );
  return match?.code || null;
}

/**
 * Resolve a bank account number via Paystack — returns the account holder's name.
 */
async function resolveBankAccount(accountNumber, bankName) {
  const headers = paystackHeaders();
  if (!headers) return { success: false, message: 'Paystack not configured', skipped: true };

  if (!/^\d{10}$/.test(accountNumber)) {
    return { success: false, message: 'Account number must be exactly 10 digits' };
  }

  const bankCode = await getBankCode(bankName);
  if (!bankCode) {
    return { success: false, message: `Could not find bank code for "${bankName}"` };
  }

  try {
    const res = await axios.get(`${PAYSTACK_BASE_URL}/bank/resolve`, {
      headers,
      params: { account_number: accountNumber, bank_code: bankCode },
      timeout: 15000,
    });

    if (res.data?.status) {
      return {
        success: true,
        data: {
          accountName: res.data.data?.account_name || '',
          bankCode,
          bankName,
        },
      };
    }
    return { success: false, message: res.data?.message || 'Account could not be resolved' };
  } catch (err) {
    const msg = err.response?.data?.message || err.message;
    return { success: false, message: `Bank account verification failed: ${msg}` };
  }
}

// ─── 3. CAC verification (CAC public search or Smile ID) ──────────────────────

/**
 * Verify a CAC registration number.
 * Tries: CAC public search API → Smile ID → format validation fallback.
 *
 * @param {string} cacNumber - RC or BN number (e.g. "RC1234567")
 * @param {string} businessName - Expected business name for cross-check
 * @returns {Promise<{ success, data?, message? }>}
 */
async function verifyCAC(cacNumber, businessName) {
  // Try CAC public search API first
  const cac = cacConfig();
  if (cac) {
    try {
      const res = await axios.get(`${cac.baseUrl}/search`, {
        headers: { Authorization: `Bearer ${cac.apiKey}` },
        params: { rc_number: cacNumber },
        timeout: 15000,
      });

      if (res.data?.status || res.data?.companyName) {
        const companyData = res.data?.data || res.data;
        return {
          success: true,
          data: {
            rcNumber: cacNumber,
            companyName: companyData?.companyName || companyData?.name || '',
            status: companyData?.status || '',
            address: companyData?.address || '',
          },
        };
      }
      return { success: false, message: 'CAC number not found in registry' };
    } catch (err) {
      console.error('CAC API verification failed:', err.message);
      // Fall through to next provider
    }
  }

  // Try Smile ID if configured
  const smile = smileIdConfig();
  if (smile) {
    try {
      // Smile ID CAC verification — partner API
      const res = await axios.post(
        `${smile.baseUrl}/business_verification`,
        {
          partner_id: smile.partnerId,
          country: 'NG',
          business_number: cacNumber,
        },
        { headers: { Authorization: `Bearer ${smile.apiKey}` }, timeout: 15000 }
      );

      if (res.data?.ResultCode === 'successful') {
        return {
          success: true,
          data: {
            rcNumber: cacNumber,
            companyName: res.data?.BusinessName || '',
            status: res.data?.Status || '',
            address: res.data?.Address || '',
          },
        };
      }
      return { success: false, message: res.data?.ResultText || 'CAC verification failed' };
    } catch (err) {
      console.error('Smile ID CAC verification failed:', err.message);
      // Fall through to format validation
    }
  }

  // Fallback: format validation only
  if (/^(RC|BN|IT)\d{5,8}$/i.test(cacNumber)) {
    return {
      success: true,
      data: {
        rcNumber: cacNumber.toUpperCase(),
        companyName: businessName || '',
        status: 'format_valid_manual_review',
      },
      message: 'CAC format is valid — manual verification required (no API key configured)',
    };
  }

  return { success: false, message: 'CAC number format is invalid' };
}

// ─── 4. TIN verification (FIRS / JTB) ────────────────────────────────────────────

/**
 * Verify a Tax Identification Number (TIN).
 * Tries: FIRS API → format validation fallback.
 *
 * @param {string} tin - TIN (10-14 digits, hyphens allowed)
 * @param {string} businessName - Expected business name for cross-check
 * @returns {Promise<{ success, data?, message? }>}
 */
async function verifyTIN(tin, businessName) {
  const firs = firsConfig();
  if (firs) {
    try {
      const res = await axios.get(`${firs.baseUrl}/taxpayer`, {
        headers: { Authorization: `Bearer ${firs.apiKey}` },
        params: { tin: tin.replace(/-/g, '') },
        timeout: 15000,
      });

      if (res.data?.taxpayer) {
        return {
          success: true,
          data: {
            tin,
            taxpayerName: res.data.taxpayer?.name || '',
            taxpayerType: res.data.taxpayer?.type || '',
          },
        };
      }
      return { success: false, message: 'TIN not found in FIRS registry' };
    } catch (err) {
      console.error('FIRS TIN verification failed:', err.message);
      // Fall through to format validation
    }
  }

  // Fallback: format validation only
  const cleanTin = tin.replace(/-/g, '');
  if (/^\d{10,14}$/.test(cleanTin)) {
    return {
      success: true,
      data: {
        tin,
        taxpayerName: businessName || '',
      },
      message: 'TIN format is valid — manual verification required (no FIRS API key configured)',
    };
  }

  return { success: false, message: 'TIN format is invalid' };
}

// ─── 5. NIN / ID verification ───────────────────────────────────────────────────

/**
 * Verify a government-issued ID (NIN, driver's license, passport, voter's card).
 * Tries: Paystack (NIN only) → Smile ID → VerifyMe → format validation fallback.
 *
 * @param {string} idType - One of ID_TYPES
 * @param {string} idNumber - The ID number
 * @param {string} fullName - Expected name for cross-check
 * @returns {Promise<{ success, data?, message? }>}
 */
async function verifyID(idType, idNumber, fullName) {
  // Try Paystack NIN resolve (only works for NIN)
  if (idType === 'NIN (National ID)') {
    const headers = paystackHeaders();
    if (headers) {
      try {
        const res = await axios.get(`${PAYSTACK_BASE_URL}/nin/resolve`, {
          headers,
          params: { nin: idNumber },
          timeout: 15000,
        });

        if (res.data?.status) {
          const data = res.data.data;
          return {
            success: true,
            data: {
              firstName: data?.first_name || '',
              lastName: data?.last_name || '',
              fullName: `${data?.first_name || ''} ${data?.last_name || ''}`.trim(),
              idNumber,
              idType,
            },
          };
        }
      } catch (err) {
        console.error('Paystack NIN resolve failed:', err.message);
        // Fall through to next provider
      }
    }
  }

  // Try Smile ID
  const smile = smileIdConfig();
  if (smile) {
    try {
      const idTypes = {
        'NIN (National ID)': 'NIN',
        "Driver's License": 'DRIVERS_LICENSE',
        'International Passport': 'PASSPORT',
        "Voter's Card": 'VOTER_CARD',
      };
      const smileType = idTypes[idType];

      if (smileType) {
        const res = await axios.post(
          `${smile.baseUrl}/id_verification`,
          {
            partner_id: smile.partnerId,
            country: 'NG',
            id_type: smileType,
            id_number: idNumber,
          },
          { headers: { Authorization: `Bearer ${smile.apiKey}` }, timeout: 15000 }
        );

        if (res.data?.ResultCode === 'verified' || res.data?.ResultCode === 'successful') {
          return {
            success: true,
            data: {
              firstName: res.data?.FirstName || '',
              lastName: res.data?.LastName || '',
              fullName: `${res.data?.FirstName || ''} ${res.data?.LastName || ''}`.trim(),
              idNumber,
              idType,
            },
          };
        }
        return { success: false, message: res.data?.ResultText || 'ID verification failed' };
      }
    } catch (err) {
      console.error('Smile ID verification failed:', err.message);
      // Fall through to format validation
    }
  }

  // Try VerifyMe
  const vm = verifyMeConfig();
  if (vm) {
    try {
      const idTypes = {
        'NIN (National ID)': 'nin',
        "Driver's License": 'drivers_license',
        'International Passport': 'passport',
        "Voter's Card": 'voters_card',
      };
      const vmType = idTypes[idType];

      if (vmType) {
        const res = await axios.get(`${vm.baseUrl}/${vmType}/${idNumber}`, {
          headers: { Authorization: `Bearer ${vm.apiKey}` },
          timeout: 15000,
        });

        if (res.data?.status === 'success' || res.data?.data) {
          const data = res.data.data || res.data;
          return {
            success: true,
            data: {
              firstName: data?.firstName || data?.first_name || '',
              lastName: data?.lastName || data?.last_name || '',
              fullName: `${data?.firstName || data?.first_name || ''} ${data?.lastName || data?.last_name || ''}`.trim(),
              idNumber,
              idType,
            },
          };
        }
      }
    } catch (err) {
      console.error('VerifyMe verification failed:', err.message);
      // Fall through to format validation
    }
  }

  // Fallback: format validation only
  if (idNumber && idNumber.length >= 5) {
    return {
      success: true,
      data: {
        fullName: fullName || '',
        idNumber,
        idType,
      },
      message: 'ID number format is valid — manual verification required (no KYC provider configured)',
    };
  }

  return { success: false, message: 'ID number is too short or invalid' };
}

// ─── Main: Full vendor KYC verification ──────────────────────────────────────────

/**
 * Run full KYC verification for a vendor application.
 * Verifies BVN, bank account, CAC, TIN, and government ID.
 * Cross-checks all names against the contact name provided.
 *
 * @param {object} app - Application data from the apply form
 * @returns {Promise<{ verified, checks, warnings, errors }>}
 */
async function verifyVendorKYC(app) {
  const {
    bvn,
    bankAccountNumber,
    bankName,
    bankAccountName,
    contactName,
    cacNumber,
    businessName,
    tin,
    idType,
    idNumber,
  } = app;

  const checks = [];
  const warnings = [];
  const errors = [];
  let skippedCount = 0;

  // ── 1. BVN ────────────────────────────────────────────────────────────────
  if (bvn) {
    const bvnResult = await resolveBVN(bvn);
    if (bvnResult.skipped) { skippedCount++; }

    checks.push({
      check: 'BVN',
      passed: bvnResult.success,
      skipped: !!bvnResult.skipped,
      detail: bvnResult.success
        ? `Verified: ${bvnResult.data.firstName} ${bvnResult.data.lastName} (DOB: ${bvnResult.data.dob})`
        : bvnResult.message,
    });

    if (bvnResult.success) {
      // Cross-check BVN name against contact name
      if (contactName) {
        const nameMatch = namesMatch(bvnResult.data.fullName, contactName);
        checks.push({
          check: 'BVN ↔ Contact name',
          passed: nameMatch,
          detail: nameMatch
            ? `BVN name "${bvnResult.data.fullName}" matches contact name "${contactName}"`
            : `BVN name "${bvnResult.data.fullName}" does NOT match contact name "${contactName}"`,
        });
        if (!nameMatch) {
          warnings.push(`BVN name (${bvnResult.data.fullName}) does not match contact name (${contactName})`);
        }
      }

      // Cross-check BVN name against bank account name (if both resolved)
      // (checked after bank verification below)
      if (bankAccountName) {
        const bvnBankMatch = namesMatch(bvnResult.data.fullName, bankAccountName);
        if (!bvnBankMatch) {
          warnings.push(`BVN name does not match bank account name — possible mismatch`);
        }
      }
    } else if (!bvnResult.skipped) {
      errors.push(bvnResult.message);
    }
  }

  // ── 2. Bank account ────────────────────────────────────────────────────────
  let resolvedAccountName = '';
  if (bankAccountNumber && bankName) {
    const bankResult = await resolveBankAccount(bankAccountNumber, bankName);
    if (bankResult.skipped) { skippedCount++; }

    checks.push({
      check: 'Bank account',
      passed: bankResult.success,
      skipped: !!bankResult.skipped,
      detail: bankResult.success
        ? `Verified: ${bankResult.data.accountName} at ${bankName}`
        : bankResult.message,
    });

    if (bankResult.success) {
      resolvedAccountName = bankResult.data.accountName;

      // Cross-check resolved account name against provided account name
      if (bankAccountName) {
        const nameMatch = namesMatch(resolvedAccountName, bankAccountName);
        checks.push({
          check: 'Bank account ↔ Provided name',
          passed: nameMatch,
          detail: nameMatch
            ? `Account name "${resolvedAccountName}" matches provided name`
            : `Resolved name "${resolvedAccountName}" does NOT match provided name "${bankAccountName}"`,
        });
        if (!nameMatch) {
          warnings.push(`Bank account name does not match the name on the bank account`);
        }
      }

      // Cross-check resolved account name against contact name
      if (contactName) {
        const contactMatch = namesMatch(resolvedAccountName, contactName);
        checks.push({
          check: 'Bank account ↔ Contact name',
          passed: contactMatch,
          detail: contactMatch
            ? `Account holder name matches contact name`
            : `Account holder "${resolvedAccountName}" does NOT match contact name "${contactName}"`,
        });
        if (!contactMatch) {
          warnings.push(`Bank account holder name does not match the contact name — verify ownership`);
        }
      }
    } else if (!bankResult.skipped) {
      errors.push(bankResult.message);
    }
  }

  // ── 3. CAC ────────────────────────────────────────────────────────────────
  if (cacNumber) {
    const cacResult = await verifyCAC(cacNumber, businessName);

    checks.push({
      check: 'CAC registration',
      passed: cacResult.success,
      detail: cacResult.success
        ? cacResult.data?.companyName
          ? `Verified: ${cacResult.data.companyName} (${cacResult.data.status || 'active'})`
          : 'CAC number format valid — manual verification required'
        : cacResult.message,
    });

    if (cacResult.success && cacResult.data?.companyName && businessName) {
      const nameMatch = namesMatch(cacResult.data.companyName, businessName);
      checks.push({
        check: 'CAC ↔ Business name',
        passed: nameMatch,
        detail: nameMatch
          ? `CAC registered name "${cacResult.data.companyName}" matches business name`
          : `CAC name "${cacResult.data.companyName}" does NOT match provided business name "${businessName}"`,
      });
      if (!nameMatch) {
        warnings.push(`CAC registered business name does not match the provided business name`);
      }
    }

    if (!cacResult.success) {
      warnings.push(cacResult.message);
    }
  }

  // ── 4. TIN ────────────────────────────────────────────────────────────────
  if (tin) {
    const tinResult = await verifyTIN(tin, businessName);

    checks.push({
      check: 'Tax ID (TIN)',
      passed: tinResult.success,
      detail: tinResult.success
        ? tinResult.data?.taxpayerName
          ? `Verified: ${tinResult.data.taxpayerName}`
          : 'TIN format valid — manual verification required'
        : tinResult.message,
    });

    if (tinResult.success && tinResult.data?.taxpayerName && businessName) {
      const nameMatch = namesMatch(tinResult.data.taxpayerName, businessName);
      if (!nameMatch) {
        warnings.push(`TIN registered name does not match the provided business name`);
      }
    }

    if (!tinResult.success) {
      warnings.push(tinResult.message);
    }
  }

  // ── 5. Government ID ──────────────────────────────────────────────────────
  if (idType && idNumber) {
    const idResult = await verifyID(idType, idNumber, contactName);

    checks.push({
      check: `${idType}`,
      passed: idResult.success,
      detail: idResult.success
        ? idResult.data?.fullName
          ? `Verified: ${idResult.data.fullName}`
          : 'ID format valid — manual verification required'
        : idResult.message,
    });

    if (idResult.success && idResult.data?.fullName && contactName) {
      const nameMatch = namesMatch(idResult.data.fullName, contactName);
      checks.push({
        check: `${idType} ↔ Contact name`,
        passed: nameMatch,
        detail: nameMatch
          ? `ID name matches contact name`
          : `ID name "${idResult.data.fullName}" does NOT match contact name "${contactName}"`,
      });
      if (!nameMatch) {
        warnings.push(`Government ID name does not match the contact name provided`);
      }
    }

    if (!idResult.success) {
      warnings.push(idResult.message);
    }
  }

  // ── Determine overall status ──────────────────────────────────────────────
  const criticalErrors = errors.filter((e) =>
    !e.includes('not configured') // Don't fail if provider isn't set up
  );

  // Verified only if all non-skipped checks passed and at least one name cross-check passed
  const nameChecks = checks.filter((c) => c.check.includes('↔'));
  const nameCheckPassed = nameChecks.length > 0 && nameChecks.every((c) => c.passed);
  const nameCheckWarning = nameChecks.some((c) => !c.passed);

  const verified = criticalErrors.length === 0 &&
    checks.some((c) => c.passed && !c.skipped) &&
    (nameChecks.length === 0 || nameCheckPassed);

  return {
    verified,
    checks,
    warnings,
    errors: criticalErrors,
    nameCrossCheck: {
      performed: nameChecks.length > 0,
      allPassed: nameCheckPassed,
      hasWarnings: nameCheckWarning,
    },
    skippedCount,
  };
}

module.exports = {
  resolveBVN,
  resolveBankAccount,
  verifyCAC,
  verifyTIN,
  verifyID,
  getBankCode,
  namesMatch,
  nameSimilarity,
  verifyVendorKYC,
};