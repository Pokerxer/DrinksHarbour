// @ts-nocheck
'use client';

import { useMemo, useState } from 'react';
import { useFormContext, Controller } from 'react-hook-form';
import {
  PiTruck, PiWarning, PiPackage, PiCurrencyNgn, PiClock,
  PiCheckCircle, PiGift, PiWarehouse, PiStorefront, PiRuler,
  PiScales, PiAirplane, PiShieldWarning, PiTimer, PiCube,
  PiInfo, PiMapPin, PiCaretDown, PiCaretUp,
} from 'react-icons/pi';

// ── Shared primitives ─────────────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-gray-400">
      {children}
    </label>
  );
}

function TextInput({ icon, suffix, ...props }: {
  icon?: React.ReactNode; suffix?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="flex items-center overflow-hidden rounded-lg border border-gray-200 bg-white focus-within:border-gray-400 transition-colors">
      {icon && <span className="ml-3 shrink-0 text-gray-400">{icon}</span>}
      <input
        {...props}
        className="flex-1 border-0 bg-transparent px-3 py-2.5 text-sm outline-none placeholder-gray-300"
      />
      {suffix && (
        <span className="mr-3 shrink-0 text-[11px] font-semibold text-gray-400">{suffix}</span>
      )}
    </div>
  );
}

function Section({
  title, desc, children, action,
}: {
  title: string; desc?: string; children: React.ReactNode; action?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-4 py-3">
        <div>
          <p className="text-xs font-bold text-gray-700">{title}</p>
          {desc && <p className="text-[10px] text-gray-400 mt-0.5">{desc}</p>}
        </div>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function Toggle({
  checked, onChange, label, description, icon,
}: {
  checked: boolean; onChange: (v: boolean) => void;
  label: string; description?: string; icon?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${
        checked ? 'border-gray-200 bg-gray-50' : 'border-gray-100 bg-white hover:bg-gray-50'
      }`}
    >
      {icon && (
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors ${
          checked ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-400'
        }`}>
          {icon}
        </span>
      )}
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold ${checked ? 'text-gray-900' : 'text-gray-700'}`}>{label}</p>
        {description && <p className="text-[10px] text-gray-400 mt-0.5">{description}</p>}
      </div>
      <div className={`relative flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
        checked ? 'bg-gray-900' : 'bg-gray-200'
      }`}>
        <span className={`absolute h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-[18px]' : 'translate-x-[3px]'
        }`} />
      </div>
    </button>
  );
}

// ── Constants ─────────────────────────────────────────────────────────────────

const CARRIERS = [
  { value: 'local_courier', label: 'Local Courier',    icon: PiTruck   },
  { value: 'inhouse',       label: 'In-House Delivery', icon: PiPackage },
  { value: 'pickup',        label: 'Customer Pickup',  icon: PiStorefront },
  { value: 'dhl',           label: 'DHL Express',      icon: PiAirplane },
  { value: 'fedex',         label: 'FedEx',            icon: PiAirplane },
  { value: 'ups',           label: 'UPS',              icon: PiTruck   },
];

const DELIVERY_AREAS = [
  { value: 'local',         label: 'Local',        range: '0–50 km'     },
  { value: 'regional',      label: 'Regional',     range: '50–200 km'   },
  { value: 'national',      label: 'National',     range: '200 km+'     },
  { value: 'international', label: 'International', range: 'Cross-border' },
];

const TIME_PRESETS = [
  { label: 'Same Day', min: 0, max: 1  },
  { label: '1–2 Days', min: 1, max: 2  },
  { label: '3–5 Days', min: 3, max: 5  },
  { label: '1 Week',   min: 5, max: 7  },
  { label: '2 Weeks',  min: 10, max: 14 },
];

const PKG_PRESETS = [
  { label: 'Wine Bottle (750ml)',   weight: 1200, length: 8,  width: 8,  height: 30 },
  { label: 'Spirit Bottle (700ml)', weight: 1000, length: 7,  width: 7,  height: 28 },
  { label: 'Beer Bottle (330ml)',   weight: 400,  length: 6,  width: 6,  height: 20 },
  { label: 'Beer Can (330ml)',      weight: 350,  length: 6,  width: 6,  height: 12 },
  { label: 'Champagne',            weight: 1500, length: 9,  width: 9,  height: 32 },
  { label: '6-Pack',               weight: 3000, length: 25, width: 20, height: 25 },
  { label: '12-Pack Case',         weight: 6000, length: 40, width: 25, height: 30 },
  { label: 'Mini (50ml)',          weight: 100,  length: 4,  width: 4,  height: 10 },
];

// ── Main component ────────────────────────────────────────────────────────────

export default function SubProductShipping() {
  const { watch, setValue, register, control } = useFormContext();

  const shipping  = watch('subProductData.shipping')  || {};
  const warehouse = watch('subProductData.warehouse') || {};

  // Read toggles directly from form state so they're always in sync with saved data
  const fragile               = shipping?.fragile               ?? true;
  const requiresAgeVerification = shipping?.requiresAgeVerification ?? true;
  const hazmat                = shipping?.hazmat                ?? false;
  const isFreeShipping        = shipping?.isFreeShipping        ?? false;
  const availableForPickup    = shipping?.availableForPickup    ?? false;

  const [showWarehouse, setShowWarehouse] = useState(
    !!(warehouse?.location || warehouse?.zone || warehouse?.aisle)
  );

  // ── Derived ────────────────────────────────────────────────────────────────

  const weight = Number(shipping?.weight) || 0;
  const length = Number(shipping?.length) || 0;
  const width  = Number(shipping?.width)  || 0;
  const height = Number(shipping?.height) || 0;

  const dimWeight      = length > 0 && width > 0 && height > 0
    ? Math.ceil((length * width * height) / 5000) : 0;
  const chargeableWeight = Math.max(weight, dimWeight);
  const hasDimensions    = weight > 0 || (length > 0 && width > 0 && height > 0);

  const shippingClass = useMemo(() => {
    if (chargeableWeight === 0)     return null;
    if (chargeableWeight <= 500)   return { label: 'Small Parcel',   cls: 'bg-green-100 text-green-700'  };
    if (chargeableWeight <= 2000)  return { label: 'Standard',       cls: 'bg-blue-100 text-blue-700'    };
    if (chargeableWeight <= 5000)  return { label: 'Medium Freight', cls: 'bg-amber-100 text-amber-700'  };
    return                                { label: 'Heavy Freight',  cls: 'bg-red-100 text-red-700'     };
  }, [chargeableWeight]);

  const estimatedCost = useMemo(() => {
    if (chargeableWeight === 0) return 0;
    if (chargeableWeight <= 500)  return 1500;
    if (chargeableWeight <= 1000) return 2500;
    if (chargeableWeight <= 2000) return 3500;
    if (chargeableWeight <= 5000) return 5000;
    return 8000;
  }, [chargeableWeight]);

  // ── Helpers ────────────────────────────────────────────────────────────────

  function setToggle(field: string, value: boolean) {
    setValue(`subProductData.shipping.${field}`, value);
  }

  function applyPreset(p: typeof PKG_PRESETS[0]) {
    setValue('subProductData.shipping.weight', p.weight);
    setValue('subProductData.shipping.length', p.length);
    setValue('subProductData.shipping.width',  p.width);
    setValue('subProductData.shipping.height', p.height);
  }

  function applyTimePreset(p: typeof TIME_PRESETS[0]) {
    setValue('subProductData.shipping.minDeliveryDays', p.min);
    setValue('subProductData.shipping.maxDeliveryDays', p.max);
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-600">
          <PiTruck className="h-5 w-5 text-white" />
        </div>
        <div>
          <p className="text-sm font-bold text-gray-900">Shipping & Logistics</p>
          <p className="text-[11px] text-gray-400 mt-0.5">
            Package dimensions, carriers, delivery times and handling requirements
          </p>
        </div>
      </div>

      {/* ── Package Dimensions ── */}
      <Section
        title="Package Dimensions"
        desc="Used to calculate shipping rates and volumetric weight"
      >
        {/* Presets */}
        <div className="mb-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">
            Beverage presets
          </p>
          <div className="flex flex-wrap gap-1.5">
            {PKG_PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => applyPreset(p)}
                className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-1.5 text-[10px] font-semibold text-gray-600 hover:border-cyan-300 hover:bg-cyan-50 hover:text-cyan-700 transition-colors"
              >
                <PiCube className="h-3 w-3" />
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Fields */}
        <div className="grid gap-4 sm:grid-cols-4">
          <div>
            <Label>Weight (g)</Label>
            <TextInput
              icon={<PiScales className="h-4 w-4" />}
              type="number" min="0" placeholder="0"
              {...register('subProductData.shipping.weight', { valueAsNumber: true })}
            />
          </div>
          <div>
            <Label>Length (cm)</Label>
            <TextInput
              icon={<PiRuler className="h-4 w-4" />}
              type="number" min="0" placeholder="0"
              {...register('subProductData.shipping.length', { valueAsNumber: true })}
            />
          </div>
          <div>
            <Label>Width (cm)</Label>
            <TextInput
              icon={<PiRuler className="h-4 w-4" />}
              type="number" min="0" placeholder="0"
              {...register('subProductData.shipping.width', { valueAsNumber: true })}
            />
          </div>
          <div>
            <Label>Height (cm)</Label>
            <TextInput
              icon={<PiRuler className="h-4 w-4" />}
              type="number" min="0" placeholder="0"
              {...register('subProductData.shipping.height', { valueAsNumber: true })}
            />
          </div>
        </div>

        {/* Summary */}
        {hasDimensions && (
          <div className="mt-4 grid gap-3 sm:grid-cols-4 rounded-xl border border-gray-100 bg-gray-50 p-3">
            <div className="text-center">
              <p className="text-[10px] text-gray-400">Actual</p>
              <p className="text-base font-black tabular-nums text-gray-800">{weight}g</p>
              <p className="text-[9px] text-gray-400">{(weight / 1000).toFixed(2)} kg</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-gray-400">Volumetric</p>
              <p className="text-base font-black tabular-nums text-gray-800">{dimWeight}g</p>
              <p className="text-[9px] text-gray-400">L×W×H ÷ 5000</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-gray-400">Chargeable</p>
              <p className="text-base font-black tabular-nums text-cyan-700">{chargeableWeight}g</p>
              <p className="text-[9px] text-gray-400">max of both</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-gray-400">Class</p>
              {shippingClass ? (
                <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${shippingClass.cls}`}>
                  {shippingClass.label}
                </span>
              ) : (
                <p className="text-base font-black text-gray-300">—</p>
              )}
            </div>
          </div>
        )}
      </Section>

      {/* ── Handling Requirements ── */}
      <Section
        title="Handling Requirements"
        desc="Declare special handling needs for this product"
      >
        <div className="grid gap-2 sm:grid-cols-2">
          <Toggle
            checked={fragile}
            onChange={(v) => setToggle('fragile', v)}
            label="Fragile"
            description="Handle with care — glass bottles etc."
            icon={<PiWarning className="h-4 w-4" />}
          />
          <Toggle
            checked={requiresAgeVerification}
            onChange={(v) => setToggle('requiresAgeVerification', v)}
            label="Age Verification"
            description="ID check required at delivery (18+)"
            icon={<PiShieldWarning className="h-4 w-4" />}
          />
          <Toggle
            checked={hazmat}
            onChange={(v) => setToggle('hazmat', v)}
            label="Hazardous Material"
            description="Alcohol / flammable — special carrier rules apply"
            icon={<PiWarning className="h-4 w-4" />}
          />
          <Toggle
            checked={availableForPickup}
            onChange={(v) => setToggle('availableForPickup', v)}
            label="Store Pickup Available"
            description="Customer can collect from store"
            icon={<PiStorefront className="h-4 w-4" />}
          />
        </div>
      </Section>

      {/* ── Free Shipping ── */}
      <Section title="Free Shipping">
        <Toggle
          checked={isFreeShipping}
          onChange={(v) => setToggle('isFreeShipping', v)}
          label="Offer free shipping"
          description="Removes shipping charges for this product"
          icon={<PiGift className="h-4 w-4" />}
        />

        {isFreeShipping && (
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Minimum Order Value (₦)</Label>
              <TextInput
                icon={<PiCurrencyNgn className="h-4 w-4" />}
                type="number" min="0" placeholder="0 = always free"
                {...register('subProductData.shipping.freeShippingMinOrder', { valueAsNumber: true })}
              />
              <p className="mt-1 text-[10px] text-gray-400">0 = always free regardless of order value</p>
            </div>
            <div>
              <Label>Label shown to customer</Label>
              <TextInput
                placeholder="Free Delivery"
                {...register('subProductData.shipping.freeShippingLabel')}
              />
            </div>
          </div>
        )}
      </Section>

      {/* ── Carrier & Delivery Area ── */}
      <Section title="Carrier & Coverage" desc="Select a shipping carrier and coverage area">

        {/* Carrier */}
        <div className="mb-5">
          <Label>Shipping Carrier</Label>
          <Controller
            name="subProductData.shipping.carrier"
            control={control}
            render={({ field }) => (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                {CARRIERS.map((c) => {
                  const Icon = c.icon;
                  const sel  = field.value === c.value;
                  return (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => field.onChange(sel ? '' : c.value)}
                      className={`relative flex flex-col items-center gap-1.5 rounded-xl border-2 p-3 text-center transition-all ${
                        sel
                          ? 'border-cyan-400 bg-cyan-50'
                          : 'border-gray-100 bg-white hover:border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      {sel && (
                        <PiCheckCircle className="absolute right-1.5 top-1.5 h-3.5 w-3.5 text-cyan-500" />
                      )}
                      <Icon className={`h-5 w-5 ${sel ? 'text-cyan-600' : 'text-gray-400'}`} />
                      <span className={`text-[10px] font-semibold leading-tight ${sel ? 'text-cyan-700' : 'text-gray-600'}`}>
                        {c.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          />
        </div>

        {/* Delivery Area */}
        <div>
          <Label>Delivery Coverage</Label>
          <Controller
            name="subProductData.shipping.deliveryArea"
            control={control}
            render={({ field }) => (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {DELIVERY_AREAS.map((a) => {
                  const sel = field.value === a.value;
                  return (
                    <button
                      key={a.value}
                      type="button"
                      onClick={() => field.onChange(sel ? '' : a.value)}
                      className={`relative flex flex-col items-center gap-1 rounded-xl border-2 py-3 px-2 text-center transition-all ${
                        sel
                          ? 'border-indigo-400 bg-indigo-50'
                          : 'border-gray-100 bg-white hover:border-gray-200'
                      }`}
                    >
                      {sel && (
                        <PiCheckCircle className="absolute right-1.5 top-1.5 h-3.5 w-3.5 text-indigo-500" />
                      )}
                      <PiMapPin className={`h-4 w-4 ${sel ? 'text-indigo-600' : 'text-gray-400'}`} />
                      <p className={`text-xs font-bold ${sel ? 'text-indigo-700' : 'text-gray-700'}`}>{a.label}</p>
                      <p className="text-[9px] text-gray-400">{a.range}</p>
                    </button>
                  );
                })}
              </div>
            )}
          />
        </div>
      </Section>

      {/* ── Delivery Time ── */}
      <Section title="Delivery Time">
        {/* Presets */}
        <div className="mb-3 flex flex-wrap gap-2">
          {TIME_PRESETS.map((p) => {
            const active = Number(shipping?.minDeliveryDays) === p.min &&
                           Number(shipping?.maxDeliveryDays) === p.max;
            return (
              <button
                key={p.label}
                type="button"
                onClick={() => applyTimePreset(p)}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[10px] font-semibold transition-colors ${
                  active
                    ? 'border-gray-800 bg-gray-900 text-white'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                <PiClock className="h-3 w-3" />
                {p.label}
              </button>
            );
          })}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Min Days</Label>
            <TextInput
              icon={<PiTimer className="h-4 w-4" />}
              type="number" min="0" placeholder="0"
              {...register('subProductData.shipping.minDeliveryDays', { valueAsNumber: true })}
            />
          </div>
          <div>
            <Label>Max Days</Label>
            <TextInput
              icon={<PiClock className="h-4 w-4" />}
              type="number" min="0" placeholder="0"
              {...register('subProductData.shipping.maxDeliveryDays', { valueAsNumber: true })}
            />
          </div>
        </div>
      </Section>

      {/* ── Shipping Cost ── */}
      <Section
        title="Shipping Cost"
        desc="Override calculated rate with a fixed cost for this product"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Fixed Cost (₦) — optional</Label>
            <TextInput
              icon={<PiCurrencyNgn className="h-4 w-4" />}
              type="number" step="0.01" min="0"
              placeholder="Leave blank for calculated rate"
              {...register('subProductData.shipping.fixedShippingCost', { valueAsNumber: true })}
            />
            <p className="mt-1 text-[10px] text-gray-400">
              Leave blank to use the calculated rate from package dimensions
            </p>
          </div>
          {hasDimensions && estimatedCost > 0 && !isFreeShipping && (
            <div className="flex flex-col justify-center rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600">
                Calculated Estimate
              </p>
              <p className="text-2xl font-black tabular-nums text-amber-700 mt-0.5">
                ₦{estimatedCost.toLocaleString()}
              </p>
              <p className="text-[10px] text-amber-500 mt-0.5">
                Based on {chargeableWeight}g chargeable weight
              </p>
            </div>
          )}
          {isFreeShipping && (
            <div className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3">
              <PiGift className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm font-bold text-green-800">Free Shipping enabled</p>
                <p className="text-[10px] text-green-600">Fixed cost is ignored</p>
              </div>
            </div>
          )}
        </div>
      </Section>

      {/* ── Warehouse Location (collapsible) ── */}
      <div className="rounded-2xl border border-gray-200 overflow-hidden">
        <button
          type="button"
          onClick={() => setShowWarehouse((v) => !v)}
          className="flex w-full items-center justify-between border-b border-gray-100 bg-gray-50 px-4 py-3 text-left"
        >
          <div>
            <div className="flex items-center gap-2">
              <p className="text-xs font-bold text-gray-700">Warehouse / Storage Location</p>
              {warehouse?.location && (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-bold text-emerald-700">
                  {[warehouse.location, warehouse.zone && `Zone ${warehouse.zone}`].filter(Boolean).join(' · ')}
                </span>
              )}
            </div>
            <p className="text-[10px] text-gray-400 mt-0.5">
              Aisle, shelf and bin for warehouse staff
            </p>
          </div>
          {showWarehouse
            ? <PiCaretUp className="h-4 w-4 shrink-0 text-gray-400" />
            : <PiCaretDown className="h-4 w-4 shrink-0 text-gray-400" />
          }
        </button>

        {showWarehouse && (
          <div className="p-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <Label>Location / Warehouse Name</Label>
                <TextInput
                  icon={<PiWarehouse className="h-4 w-4" />}
                  placeholder="Main Warehouse"
                  {...register('subProductData.warehouse.location')}
                />
              </div>
              <div>
                <Label>Zone</Label>
                <TextInput
                  icon={<PiMapPin className="h-4 w-4" />}
                  placeholder="A"
                  {...register('subProductData.warehouse.zone')}
                />
              </div>
              <div>
                <Label>Aisle</Label>
                <TextInput
                  placeholder="1"
                  {...register('subProductData.warehouse.aisle')}
                />
              </div>
              <div>
                <Label>Shelf</Label>
                <TextInput
                  placeholder="B"
                  {...register('subProductData.warehouse.shelf')}
                />
              </div>
              <div>
                <Label>Bin</Label>
                <TextInput
                  placeholder="3"
                  {...register('subProductData.warehouse.bin')}
                />
              </div>
            </div>

            {/* Address summary */}
            {warehouse?.location && (
              <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 mb-1">
                  Location reference
                </p>
                <p className="text-sm font-semibold text-emerald-800">
                  {[
                    warehouse.location,
                    warehouse.zone  && `Zone ${warehouse.zone}`,
                    warehouse.aisle && `Aisle ${warehouse.aisle}`,
                    warehouse.shelf && `Shelf ${warehouse.shelf}`,
                    warehouse.bin   && `Bin ${warehouse.bin}`,
                  ].filter(Boolean).join(' · ')}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Tips ── */}
      <div className="flex items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3">
        <PiInfo className="h-4 w-4 shrink-0 text-blue-500 mt-0.5" />
        <div>
          <p className="text-xs font-semibold text-blue-800 mb-1">Tips</p>
          <ul className="text-[10px] text-blue-700 space-y-0.5 list-disc list-inside">
            <li>Age verification is required by law for alcohol deliveries in Nigeria</li>
            <li>Fragile + hazmat flags help carriers handle alcohol products correctly</li>
            <li>Free shipping with a minimum order threshold can increase average order value</li>
            <li>Volumetric weight = L × W × H ÷ 5000 — whichever is higher is charged</li>
          </ul>
        </div>
      </div>

    </div>
  );
}
