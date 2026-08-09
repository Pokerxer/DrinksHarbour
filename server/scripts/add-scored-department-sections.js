/**
 * Extend the scored assessment to every remaining department.
 *
 * The template already carries the Facilities (cleaner) sheet — see
 * create-cleaner-scored-template.js for the design of a scored anchor. This
 * adds the other five sheets to the SAME template, each section scoped to its
 * department, so `filterSections` hands every employee exactly their own 20
 * criteria and nobody else's.
 *
 * Because the sheets are department-scoped and not job-title-scoped (sections
 * carry `departments`, and nothing in the module filters on job title), a
 * department gets ONE sheet. Retail employs both cashiers and guest-services
 * attendants, so its 20 criteria are a merge of the two source lists rather
 * than both lists concatenated — 40 criteria would have made Retail's total
 * /200 while every other department scored /100, and a score that means a
 * different thing per department is not a score.
 *
 * Every criterion is worth 5, 20 criteria per department, so each sheet is a
 * clean /100 with a floor of 20 (no anchor is worth zero).
 *
 * APPENDS, never rewrites. New sections are pushed onto the existing array so
 * the Facilities sections — and every `_id` under them — are not touched at
 * all. A question `_id` is its identity across template versions; rebuilding
 * the array to "update" it would remint them and orphan any stored answer.
 *
 * Usage:
 *   node scripts/add-scored-department-sections.js            # dry run
 *   node scripts/add-scored-department-sections.js --apply    # write
 *
 * Writes nothing without --apply. Idempotent: a department whose sections are
 * already present is skipped.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env'), quiet: true });
const mongoose = require('mongoose');
const AppraisalTemplate = require('../models/AppraisalTemplate');
const { validateTemplateShape, hasLaunchedCycleFor } = require('../controllers/appraisalTemplate.controller');

const APPLY = process.argv.includes('--apply');
const TENANT = '699165839f3308b1baeca8fc';
const TEMPLATE_ID = '6a78434262e70bb58fd574b8';
// The sheet now covers every department, so the name it was created under no
// longer describes it.
const NEW_NAME = 'Scored Performance Assessment';

const DEPT = {
  retail: '6a774a5bce8af457bda41942',
  management: '6a774a5bce8af457bda41946',
  warehouse: '6a77b54486eb9115f01c8836',
  logistics: '6a77b54586eb9115f01c883e',
  marketing: '6a77b54886eb9115f01c884a',
};

// Best-to-worst, matching the order the anchors are written in. Distinct by
// construction — the score is what identifies which anchor was chosen when the
// answer is read back, so duplicates are rejected at validation.
const SCORES = [5, 4, 3, 2, 1];

/**
 * [department, [ [sectionTitle, [ [label, helpText, [a5,a4,a3,a2,a1]] ]] ]]
 *
 * Wording is person-neutral throughout: each criterion is asked of BOTH `self`
 * and `manager`, one label serves every kind, and an anchor saying "this
 * cashier" would be wrong on the employee's own form.
 */
const GROUPS = [
  [DEPT.marketing, 'Digital Marketing & Sales', [
    ['Sales & Customer Growth', [
      ['Sales Target Achievement', 'Achievement of individual or team sales targets.', [
        'Consistently meets or exceeds target; growth sustained across the period',
        'Meets target in most periods; shortfalls small and recovered',
        'Around target, but only in the stronger months',
        'Below target more often than not',
        'Well short of target with no recovery trend',
      ]],
      ['Lead Generation', 'Generating genuine potential customers.', [
        'A steady flow of well-qualified leads, sourced without prompting',
        'Good volume of leads; quality generally sound',
        'Leads come in, but many are unqualified or go nowhere',
        'Few leads, and mostly from inbound traffic rather than effort',
        'Little or no genuine lead generation',
      ]],
      ['Lead Conversion', 'Turning enquiries and prospects into paying customers.', [
        'Prospects are followed through to purchase at a consistently high rate',
        'Most serious enquiries are converted; follow-up is reliable',
        'Converts the easy enquiries; harder prospects are not pursued',
        'Enquiries are answered but rarely closed',
        'Enquiries go cold without follow-up',
      ]],
      ['Customer Acquisition', 'Bringing new customers to the business.', [
        'A clear, measurable stream of new buyers attributable to this work',
        'New customers gained steadily through the period',
        'Some new customers, mostly incidental rather than pursued',
        'Very few genuinely new customers',
        'No measurable new customer acquisition',
      ]],
      ['Customer Retention', 'Following up and encouraging existing customers to buy again.', [
        'Existing customers are actively nurtured and repeat purchases are visible',
        'Regular follow-up; repeat business is encouraged and happens',
        'Follow-up happens when convenient, not systematically',
        'Existing customers are rarely contacted after the first sale',
        'No follow-up; customers are left to return on their own or not at all',
      ]],
    ]],
    ['Content & Audience', [
      ['Social Media Growth', 'Growth in relevant followers and audience.', [
        'Sustained growth in a genuinely relevant audience, not vanity numbers',
        'Audience grows steadily across assigned channels',
        'Growth is slow or concentrated in one channel only',
        'Audience is flat despite activity',
        'Audience static or declining',
      ]],
      ['Content Quality', 'Quality, creativity and professionalism of posts, videos and campaigns.', [
        'Polished, on-brand and creative; work stands up against competitors',
        'Good standard; occasional piece needs reworking',
        'Acceptable but formulaic; little creative development',
        'Rough or inconsistent; needs correction before publishing',
        'Below the standard the brand can be seen with',
      ]],
      ['Content Consistency', 'Posting according to the agreed content calendar.', [
        'Calendar followed exactly; publishing never slips',
        'Almost always on schedule; rare slip communicated',
        'Broadly on schedule, with noticeable gaps in busy weeks',
        'Posting is irregular and the calendar is often ignored',
        'No reliable schedule; posting happens when remembered',
      ]],
      ['Audience Engagement', 'Comments, shares, saves, replies and meaningful interaction.', [
        'Content reliably provokes real interaction, and every reply is engaged with',
        'Good engagement levels; replies handled promptly',
        'Some engagement, but comments and replies are often left unanswered',
        'Little interaction; audience is passive',
        'No meaningful engagement, and comments go unanswered',
      ]],
      ['Campaign Performance', 'Results achieved from promotions and marketing campaigns.', [
        'Campaigns deliver measurable, reported results against clear objectives',
        'Campaigns generally achieve what they set out to',
        'Mixed results; outcomes are not always measured',
        'Campaigns run but results are weak or unmeasured',
        'Campaigns deliver nothing identifiable',
      ]],
    ]],
    ['Enquiries, Product & Brand', [
      ['Digital Enquiry Response', 'Speed and quality of responses to DMs, WhatsApp and online enquiries.', [
        'Answered quickly and completely at every hour the channel is staffed',
        'Prompt and helpful; occasional delay at peak',
        'Answered eventually; detail sometimes thin',
        'Slow enough that customers chase or give up',
        'Enquiries regularly go unanswered',
      ]],
      ['Product Knowledge', 'Knowledge of products, brands, prices, offers and alternatives.', [
        'Deep and current; can advise on alternatives and pricing without checking',
        'Solid knowledge across the main range',
        'Knows the popular lines; unsure beyond them',
        'Frequently has to check basics before answering',
        'Weak enough to give customers wrong information',
      ]],
      ['Upselling & Cross-Selling', 'Increasing transaction value through appropriate recommendations.', [
        'Routinely identifies genuinely suitable additions that customers accept',
        'Regularly suggests relevant complementary or premium items',
        'Suggests extras occasionally, usually when prompted',
        'Rarely goes beyond what was asked for',
        'Never attempts it, or pushes unsuitable items',
      ]],
      ['Creativity & Initiative', 'Developing new ideas rather than waiting for every instruction.', [
        'Brings forward workable new ideas and follows them through',
        'Contributes ideas regularly and acts on them once agreed',
        'Will improve on an instruction, but rarely originates anything',
        'Works only to instruction',
        'Waits to be told, and resists new approaches',
      ]],
      ['Brand Representation', "Maintaining the company's desired image, voice and standards.", [
        'Tone, look and conduct are consistently on-brand across every channel',
        'Represents the brand well; occasional off-tone piece',
        'Generally acceptable, but voice drifts between posts',
        'Frequently off-brand in tone or presentation',
        'Has published material that damaged how the business is seen',
      ]],
    ]],
    ['Reporting & Contribution', [
      ['Marketing & Sales Reporting', 'Accurate reports on sales, leads, campaigns and performance.', [
        'Accurate, on time, and includes what the numbers actually mean',
        'Reports are accurate and submitted when due',
        'Reports arrive but need chasing or correcting',
        'Late, incomplete, or figures do not reconcile',
        'Reports not produced',
      ]],
      ['Teamwork & Collaboration', 'Working effectively with store staff, management and other team members.', [
        'Actively coordinates with the shop floor and management; shares information unasked',
        'Cooperates well and responds to requests',
        'Works alongside others but stays in own lane',
        'Coordination is poor; others find out about campaigns late',
        'Creates friction or works around the rest of the team',
      ]],
      ['Punctuality & Reliability', 'Meeting deadlines, attending work and meetings, completing assignments on time.', [
        'Deadlines and commitments met without exception',
        'Reliable; the rare slip is flagged in advance',
        'Mostly reliable, but deadlines need reminding',
        'Deadlines are missed often enough to disrupt plans',
        'Unreliable on both attendance and deadlines',
      ]],
      ['Accountability & Use of Resources', 'Responsible use of advertising budgets, company accounts, equipment and other resources.', [
        'Spend is justified, documented and reconciled; accounts and equipment handled carefully',
        'Resources used responsibly; records kept',
        'Broadly careful, but spend is not always documented',
        'Spend or account use is loose and hard to reconcile',
        'Resources misused, or spend cannot be accounted for',
      ]],
      ['Overall Business Contribution', 'Overall measurable contribution to revenue, visibility and customer growth.', [
        'A clear, evidenced contribution to revenue and reach over the period',
        'A solid positive contribution',
        'Contribution is real but modest or hard to evidence',
        'Little measurable contribution to the business',
        'No demonstrable contribution',
      ]],
    ]],
  ]],

  [DEPT.warehouse, 'Warehouse', [
    ['Stock Accuracy & Control', [
      ['Inventory Accuracy', 'Physical stock agreeing with system records.', [
        'Counts agree with the system consistently; variances are rare and explained',
        'Accurate, with small variances resolved quickly',
        'Broadly accurate, but variances recur in the same areas',
        'Frequent discrepancies that take time to resolve',
        'System and physical stock cannot be relied on to agree',
      ]],
      ['Stock Receiving Accuracy', 'Verifying quantities, products, batches and condition of incoming stock.', [
        'Every delivery checked in full against the document before acceptance',
        'Thorough checking; occasional item verified after the fact',
        'Quantities checked, but condition or batch sometimes not',
        'Deliveries signed for with only a cursory look',
        'Stock accepted without checking, and errors surface later',
      ]],
      ['Dispatch Accuracy', 'Ensuring correct products and quantities leave the warehouse.', [
        'Outbound loads are right every time; errors are caught before they leave',
        'Accurate dispatch; rare error caught quickly',
        'Mostly accurate, with occasional wrong item or count',
        'Dispatch errors are frequent enough that customers notice',
        'Regular wrong deliveries traced back to picking',
      ]],
      ['Stock Reconciliation', 'Conducting and documenting regular stock counts and reconciliations.', [
        'Counts done on schedule, fully documented, differences investigated and closed',
        'Regular counts, properly recorded',
        'Counts happen but documentation is thin or late',
        'Counts are irregular and poorly recorded',
        'No reliable count or reconciliation process',
      ]],
      ['Loss & Shrinkage Control', 'Minimising unexplained shortages, theft and stock losses.', [
        'Losses are negligible, and the controls preventing them are visible',
        'Shrinkage low and investigated when it occurs',
        'Some unexplained loss, addressed only after it is raised',
        'Persistent unexplained shortages',
        'Significant losses with no control or explanation',
      ]],
      ['Breakage & Damage Control', 'Reducing avoidable damage and properly recording incidents.', [
        'Very little avoidable damage, and every incident recorded with its cause',
        'Damage low; incidents reported',
        'Occasional avoidable damage, not always recorded',
        'Regular breakages, poorly documented',
        'Frequent damage, often concealed or unreported',
      ]],
    ]],
    ['Storage & Organisation', [
      ['Stock Rotation', 'FIFO/FEFO practice and prevention of ageing or expired stock.', [
        'Rotation applied without exception; ageing stock identified before it becomes a problem',
        'Rotation followed; expiry monitored',
        'Rotation applied inconsistently across product groups',
        'Rotation often ignored; ageing stock accumulates',
        'No rotation discipline; expired stock reaches customers or is written off',
      ]],
      ['Storage Standards', 'Storing products correctly and protecting them from unsuitable conditions.', [
        'Everything stored correctly and protected from heat, damp and contamination',
        'Storage is sound; occasional item in the wrong place',
        'Acceptable, but some products stored without regard to condition',
        'Storage regularly exposes stock to damage',
        'Storage conditions are causing loss',
      ]],
      ['Warehouse Organisation', 'Logical, accessible and properly labelled stock locations.', [
        'Layout is logical and labelled; anyone can find any item quickly',
        'Well organised; labelling mostly current',
        'Workable, but relies on knowing where things are',
        'Disorganised; time is lost locating stock',
        'No usable location system',
      ]],
      ['Stock Movement Documentation', 'Recording every receipt, transfer, return and dispatch.', [
        'Every movement recorded at the time it happens, with no gaps',
        'Movements recorded reliably',
        'Most movements recorded, some retrospectively',
        'Records are incomplete and reconstructed later',
        'Movements routinely unrecorded',
      ]],
      ['System / Inventory Management', "Accurate use and updating of the company's inventory system.", [
        'System is kept live and accurate, and used to drive decisions',
        'System updated promptly and correctly',
        'System updated, but in batches rather than as work happens',
        'System lags reality and is not trusted',
        'System not maintained',
      ]],
    ]],
    ['Availability, Security & Team', [
      ['Replenishment & Stock Availability', 'Identifying low stock and coordinating timely replenishment.', [
        'Shortages anticipated and prevented; the shop rarely runs out',
        'Low stock flagged in good time',
        'Replenishment happens, but often only once stock is already short',
        'Stock-outs are common and reactive',
        'No monitoring; shortages discovered by the sales floor',
      ]],
      ['Warehouse Security', 'Controlling access to stock and following security procedures.', [
        'Access is properly controlled and procedures followed without exception',
        'Security procedures followed reliably',
        'Procedures followed when convenient',
        'Access control is loose; unauthorised entry is possible',
        'Security is effectively absent',
      ]],
      ['Warehouse Team Supervision', 'Assigning duties and monitoring warehouse staff performance.', [
        'Duties clearly assigned and followed up; the team knows what is expected',
        'Team is supervised effectively',
        'Supervision is present but inconsistent',
        'Little effective oversight; work is left unchecked',
        'No supervision; team performance drifts',
      ]],
      ['Safety & Housekeeping', 'Maintaining a clean, safe and obstruction-free warehouse.', [
        'Consistently clean, clear and safe; hazards dealt with immediately',
        'Good standards maintained',
        'Acceptable, but aisles and hazards need prompting',
        'Regularly cluttered or obstructed',
        'Conditions present a genuine safety risk',
      ]],
    ]],
    ['Reporting & Conduct', [
      ['Reporting', 'Accurate and timely stock, shortage, damage and operational reports.', [
        'Accurate, on time, and flags what needs attention',
        'Reports accurate and submitted when due',
        'Reports arrive but need chasing or correcting',
        'Late or incomplete',
        'Reports not produced',
      ]],
      ['Problem Solving & Initiative', 'Identifying stock and warehouse issues early and acting.', [
        'Problems are spotted and solved before they reach anyone else',
        'Acts on issues promptly once identified',
        'Raises problems but waits for direction to act',
        'Problems are noticed late, after impact',
        'Problems are ignored until escalated by others',
      ]],
      ['Communication & Coordination', 'Working with management, sales, cashiers, attendants and delivery teams.', [
        'Keeps every dependent team informed ahead of need',
        'Communicates clearly and responds promptly',
        'Communicates when asked, rarely proactively',
        'Poor coordination causes avoidable delays for others',
        'Communication breakdown affects daily operations',
      ]],
      ['Integrity & Accountability', 'Trustworthiness and responsibility for stock under their control.', [
        'Fully accountable; discrepancies disclosed unprompted and owned',
        'Honest and reliable; owns errors',
        'Honest when asked, but does not volunteer problems',
        'Deflects responsibility for stock discrepancies',
        'Conceals losses or misreports stock',
      ]],
      ['Overall Warehouse Performance', 'Efficiency, discipline, reliability and contribution to smooth operations.', [
        'The warehouse runs smoothly and predictably; a clear asset to operations',
        'Runs well with only minor issues',
        'Functions adequately but needs oversight',
        'Recurring problems disrupt other departments',
        'Warehouse performance is a drag on the business',
      ]],
    ]],
  ]],

  [DEPT.logistics, 'Logistics', [
    ['Reliability & Road Safety', [
      ['Punctuality', 'Reporting for duty and scheduled trips on time.', [
        'Ready to depart at the scheduled time on effectively every run',
        'On time for almost all trips; rare delay communicated',
        'Generally on time, but late often enough to be noticed',
        'Late regularly, delaying deliveries',
        'Frequently late without notice',
      ]],
      ['Attendance & Reliability', 'Consistent attendance and dependable availability.', [
        'Available for every scheduled duty; absences rare and properly notified',
        'Good attendance; occasional absence notified in good time',
        'Attendance acceptable, but notice is often short',
        'Absences frequent enough to disrupt the delivery schedule',
        'Absent without notice often enough that runs cannot be planned',
      ]],
      ['Safe Driving', 'Driving responsibly and observing road safety rules.', [
        'Consistently careful and hazard-aware; no unsafe driving observed or reported',
        'Safe driving is the norm; occasional lapse corrected',
        'Generally safe, but takes risks under time pressure',
        'Unsafe habits observed and raised more than once',
        'Driving presents a real danger to others',
      ]],
      ['Traffic Law Compliance', 'Obeying traffic regulations and avoiding preventable violations.', [
        'No violations; regulations observed even when inconvenient',
        'Compliant; at most a single minor infringement',
        'Occasional violations, usually when running late',
        'Repeat violations and accumulating penalties',
        'Persistent disregard for traffic law',
      ]],
      ['Accident / Incident Record', 'Avoiding preventable accidents and reporting incidents promptly.', [
        'No preventable incidents; anything at all is reported immediately',
        'Clean record; incidents reported properly',
        'A minor preventable incident, reported after some delay',
        'More than one preventable incident, or late reporting',
        'Serious or repeated preventable incidents, or concealment',
      ]],
    ]],
    ['Vehicle Care', [
      ['Vehicle Care', 'Handling company vehicles responsibly and preventing avoidable damage.', [
        'Vehicle handled with evident care; no avoidable wear or damage',
        'Careful; very occasional minor mark, reported',
        'Generally careful, but needs reminding on loading and clearances',
        'Avoidable damage occurs more than occasionally',
        'Repeated damage through careless handling',
      ]],
      ['Vehicle Cleanliness', 'Keeping the assigned vehicle clean and presentable.', [
        'Interior, exterior and cargo area consistently clean and presentable',
        'Kept clean; occasional lapse after a heavy run',
        'Cleaned when prompted',
        'Often dirty enough to reflect on the business',
        'Consistently unfit to be seen at a customer',
      ]],
      ['Routine Vehicle Checks', 'Checking tyres, oil, coolant, lights, brakes and other essentials.', [
        'Full pre-journey checks done and logged every time',
        'Checks done reliably',
        'Checks done, but rushed or partial',
        'Checks skipped when in a hurry',
        'Checks not done; faults found only when something fails',
      ]],
      ['Maintenance Reporting', 'Promptly reporting faults, warning lights and servicing needs.', [
        'Faults reported immediately and described clearly enough to act on',
        'Reports faults promptly',
        'Reports faults, but after some delay',
        'Faults reported late, allowing damage to worsen',
        'Faults concealed or ignored until breakdown',
      ]],
      ['Fuel Management', 'Using fuel responsibly and recording purchases and usage.', [
        'Consumption is efficient and every purchase is documented and reconciles',
        'Fuel used sensibly; records kept',
        'Records kept, but consumption is higher than the route warrants',
        'Consumption or records do not reconcile',
        'Fuel use cannot be accounted for',
      ]],
    ]],
    ['Delivery Performance', [
      ['Delivery Accuracy', 'Ensuring correct goods reach the correct customer and location.', [
        'Right goods, right customer, every time; discrepancies caught before leaving',
        'Accurate; rare error caught and corrected',
        'Mostly accurate, with occasional wrong drop or count',
        'Errors frequent enough that customers complain',
        'Regular wrong deliveries',
      ]],
      ['Timeliness of Deliveries', 'Completing deliveries and assignments within reasonable time.', [
        'Routes planned well; deliveries consistently completed within time',
        'Deliveries on time; occasional delay explained',
        'Generally on time, but with little margin',
        'Deliveries frequently run late',
        'Assignments regularly unfinished or badly overrun',
      ]],
      ['Product Handling', 'Careful loading and transport of drinks; minimising breakages.', [
        'Loads are secured properly; breakages effectively nil',
        'Careful handling; very occasional breakage',
        'Generally careful, but loading needs supervision',
        'Breakages occur regularly through poor loading',
        'Frequent avoidable breakage in transit',
      ]],
      ['Documentation', 'Handling delivery notes, receipts, waybills and other records.', [
        'All paperwork complete, signed and returned the same day',
        'Documentation complete and returned promptly',
        'Documentation returned, sometimes incomplete or late',
        'Paperwork often missing or unsigned',
        'Documentation not maintained',
      ]],
      ['Cash / Payment Responsibility', 'Safely handling and promptly accounting for customer payments.', [
        'Every payment accounted for and remitted the same day, without exception',
        'Payments handled correctly and remitted promptly',
        'Payments accounted for, but remittance is sometimes late',
        'Discrepancies or delays in remitting collected money',
        'Money unaccounted for',
      ]],
    ]],
    ['Conduct & Commitment', [
      ['Customer Service & Conduct', 'Behaving politely and professionally with customers.', [
        'Courteous and professional at every drop; customers comment positively',
        'Polite and professional',
        'Civil, but transactional and without warmth',
        'Conduct at a delivery has had to be raised',
        'Rude or unprofessional conduct has cost goodwill',
      ]],
      ['Communication', 'Keeping supervisors informed about deliveries, delays and completions.', [
        'Proactively reports progress, delays and completions without being asked',
        'Communicates reliably when it matters',
        'Reports when asked, rarely before',
        'Supervisors have to chase for basic status',
        'Goes silent; whereabouts and progress unknown',
      ]],
      ['Following Instructions', 'Following approved routes, assignments and company procedures.', [
        'Routes and procedures followed exactly; deviations agreed in advance',
        'Follows instructions; occasional reminder needed',
        'Follows the main instruction but improvises on detail',
        'Deviates from routes or procedures without agreement',
        'Routinely disregards assignments and procedure',
      ]],
      ['Integrity & Accountability', 'Trustworthy with vehicles, products, fuel, money and company property.', [
        'Complete trustworthiness; problems disclosed unprompted and owned',
        'Honest and reliable; owns errors',
        'Honest when asked, but does not volunteer problems',
        'Explains away discrepancies in stock, fuel or cash',
        'Dishonesty with company property, product or money',
      ]],
      ['Overall Attitude & Commitment', 'Discipline, flexibility, initiative and commitment to the job.', [
        'Disciplined, flexible and willing; can be relied on when plans change',
        'Positive and dependable',
        'Does the job willingly, without particular flexibility',
        'Resistant to changes in route or schedule',
        'Uncooperative, and it affects the delivery operation',
      ]],
    ]],
  ]],

  [DEPT.management, 'Management', [
    ['Leadership & Sales', [
      ['Leadership & Team Management', 'Leading, motivating and coordinating staff.', [
        'Sets clear direction and gets willing effort; the team performs without constant supervision',
        'Leads effectively; the team knows what is expected',
        'Manages the day to day, but provides little direction or motivation',
        'Team lacks direction; performance depends on who is watching',
        'Leadership is absent or actively demotivating',
      ]],
      ['Sales Performance', 'Driving sales and working towards or exceeding targets.', [
        'Targets consistently met or exceeded, with the actions behind it visible',
        'Targets met in most periods',
        'Around target, but only when conditions are favourable',
        'Below target more often than not',
        'Sustained underperformance against target',
      ]],
      ['Staff Supervision', 'Ensuring staff perform assigned duties and maintain standards.', [
        'Duties assigned and followed up; standards hold whether or not the manager is present',
        'Supervision is effective and consistent',
        'Supervision happens, but standards slip without direct presence',
        'Little effective follow-up; work goes unchecked',
        'No meaningful supervision',
      ]],
      ['Customer Service Management', 'Ensuring excellent customer experience and resolving escalations.', [
        'Service standards are enforced and escalations resolved fully and quickly',
        'Good service standards; escalations handled properly',
        'Handles escalations, but does not drive standards proactively',
        'Complaints recur because root causes are not addressed',
        'Customer experience is poor and unmanaged',
      ]],
      ['Product Knowledge', 'Knowledge of products, brands, pricing and categories.', [
        'Authoritative across the range; can coach staff and advise customers directly',
        'Strong knowledge across the main range',
        'Knows the popular lines; unsure beyond them',
        'Frequently has to check basics',
        'Insufficient to lead a sales team',
      ]],
    ]],
    ['Stock & Financial Control', [
      ['Stock & Inventory Control', 'Monitoring stock levels, discrepancies, damages and movement.', [
        'Stock position is known and controlled at all times; discrepancies caught early',
        'Stock monitored and issues addressed',
        'Monitored periodically; problems found late',
        'Little effective control; discrepancies accumulate',
        'Stock position is effectively unmanaged',
      ]],
      ['Loss & Shrinkage Control', 'Minimising theft, shortages, breakages and avoidable losses.', [
        'Losses minimal, with visible controls and follow-through on every incident',
        'Losses low and investigated',
        'Losses addressed only once they become obvious',
        'Persistent unexplained losses',
        'Significant losses with no control',
      ]],
      ['Cash & Financial Control', 'Ensuring proper cash handling, reconciliation and procedures.', [
        'Cash procedures enforced without exception; reconciliations clean and timely',
        'Cash controls sound; discrepancies rare and resolved',
        'Controls in place but not consistently enforced',
        'Recurring cash discrepancies',
        'Cash handling is not controlled',
      ]],
      ['Operational Efficiency', 'Ensuring smooth and efficient daily operations.', [
        'Operations run smoothly; problems are anticipated rather than reacted to',
        'Runs efficiently with minor friction',
        'Functions, but with avoidable delays and rework',
        'Recurring operational problems',
        'Operations are disorganised',
      ]],
      ['Staff Scheduling & Attendance Management', 'Managing shifts, lateness, absenteeism and manpower.', [
        'Rota always covered; lateness and absence addressed consistently and early',
        'Scheduling is sound; issues addressed',
        'Rota covered, but lateness and absence go unchallenged',
        'Cover gaps and unmanaged absence disrupt trading',
        'Scheduling is not managed',
      ]],
    ]],
    ['Decision Making & Communication', [
      ['Problem Solving & Decision Making', 'Handling operational challenges and making sound decisions.', [
        'Decisive and sound; problems resolved at the right level without escalation',
        'Makes good decisions and acts promptly',
        'Decides, but slowly or after escalating what could be handled locally',
        'Avoids decisions; problems persist',
        'Poor decisions create further problems',
      ]],
      ['Initiative & Proactiveness', 'Identifying opportunities and problems without waiting for senior management.', [
        'Identifies and acts on opportunities and risks before being asked',
        'Acts on clear needs unprompted',
        'Raises issues but waits for instruction to act',
        'Acts only on direction',
        'Neither notices nor acts',
      ]],
      ['Communication', 'Communicating clearly to staff and senior management.', [
        'Information flows both ways reliably; nothing important is learned late',
        'Communicates clearly and promptly',
        'Communicates when asked; upward reporting is thin',
        'Poor communication leaves staff or management uninformed',
        'Communication failures cause real problems',
      ]],
      ['Reporting & Documentation', 'Submitting accurate, complete and timely operational reports.', [
        'Accurate, complete, on time, and interprets what the numbers mean',
        'Reports accurate and on time',
        'Reports arrive but need chasing or correcting',
        'Late or incomplete',
        'Reports not produced',
      ]],
      ['Discipline & Policy Enforcement', 'Consistently implementing company rules and procedures.', [
        'Policy applied consistently to everyone, including when it is uncomfortable',
        'Rules enforced reliably',
        'Enforced unevenly, depending on the person or the day',
        'Rules widely ignored without consequence',
        'Policy is not enforced at all',
      ]],
    ]],
    ['Development & Contribution', [
      ['Staff Development & Coaching', 'Training, correcting and developing employees.', [
        'Staff visibly improve; coaching and correction are routine and constructive',
        'Develops staff and gives useful feedback',
        'Corrects mistakes but does little active development',
        'No meaningful development; staff stagnate',
        'Correction is absent or handled destructively',
      ]],
      ['Merchandising & Store Standards', 'Product display, organisation and cleanliness.', [
        'Store consistently well presented, organised and clean without prompting',
        'Standards good and maintained',
        'Acceptable, but slips without reminders',
        'Presentation regularly below standard',
        'Store standards are poor enough to affect sales',
      ]],
      ['Integrity & Accountability', 'Honesty and responsibility for decisions and results.', [
        'Owns outcomes fully, including bad ones; nothing is concealed or deflected',
        'Honest and accountable; owns errors',
        'Accountable when asked, but does not volunteer problems',
        'Deflects responsibility onto staff or circumstances',
        'Conceals or misreports results',
      ]],
      ['Punctuality, Attendance & Reliability', 'Demonstrating the standard expected of other employees.', [
        'Sets the standard; present, punctual and dependable without exception',
        'Reliable; rare absence properly notified',
        'Acceptable, but not an example to the team',
        'Lateness or absence undermines authority to enforce it',
        'Attendance is worse than that expected of staff',
      ]],
      ['Overall Business Contribution', 'Contribution to growth, profitability, customer retention and improvement.', [
        'A clear, evidenced contribution to the growth and profitability of the business',
        'A solid positive contribution',
        'Holds the position steady without improving it',
        'Little contribution beyond keeping the doors open',
        'A net drag on the business',
      ]],
    ]],
  ]],

  [DEPT.retail, 'Retail', [
    ['Reliability & Presentation', [
      ['Punctuality', 'Reporting for shifts and handovers on time.', [
        'Ready to start at the scheduled time on effectively every shift',
        'On time for almost all shifts; rare lateness communicated in advance',
        'Generally on time, but late often enough to be noticed',
        'Late regularly, or on time but not ready to start',
        'Frequently late without notice, and it continues after being raised',
      ]],
      ['Attendance & Reliability', 'Regular attendance and availability for assigned shifts.', [
        'Present for every scheduled shift; absences rare and properly notified',
        'Good attendance; occasional absence notified in good time',
        'Attendance acceptable, but notice is often short',
        'Absences frequent enough to disrupt cover',
        "Absent without notice often enough that the rota can't be relied on",
      ]],
      ['Personal Appearance & Professionalism', 'Neat, clean and appropriately dressed presentation on the floor.', [
        'Always neatly presented and in correct uniform at the start of every shift',
        'Generally well presented; occasional lapse',
        'Acceptable, but needs occasional prompting',
        'Presentation inconsistent or uniform often incomplete',
        'Falls below what a customer-facing role requires',
      ]],
    ]],
    ['Customer Service & Sales', [
      ['Customer Greeting & Approach', 'Welcoming and attending to customers promptly.', [
        'Every customer acknowledged and approached promptly, even when busy',
        'Customers attended to quickly and warmly',
        'Customers are served, but must often approach first',
        'Customers wait or are overlooked',
        'Customers routinely ignored until they ask',
      ]],
      ['Customer Service', 'Polite, respectful, patient and professional interaction.', [
        'Warm and professional with every customer, including difficult ones',
        'Polite and professional throughout',
        'Civil but transactional',
        'Manner has had to be raised more than once',
        'Rudeness or impatience has cost custom',
      ]],
      ['Product Knowledge', 'Products, brands, categories, sizes and prices.', [
        'Deep and current; can advise on alternatives and prices without checking',
        'Solid knowledge across the main range',
        'Knows the popular lines; unsure beyond them',
        'Frequently has to check basics before answering',
        'Weak enough to give customers wrong information',
      ]],
      ['Product Recommendation', 'Helping customers choose suitable products confidently.', [
        'Listens, understands the need, and recommends confidently and correctly',
        'Makes sound recommendations when asked',
        'Recommends only the obvious or most familiar item',
        'Avoids recommending; points customers at the shelf',
        'Recommends unsuitable products, or none at all',
      ]],
      ['Upselling & Cross-Selling', 'Recommending complementary or higher-value products.', [
        'Routinely identifies genuinely suitable additions that customers accept',
        'Regularly suggests relevant complementary or premium items',
        'Suggests extras occasionally, usually when prompted',
        'Rarely goes beyond what was asked for',
        'Never attempts it, or pushes unsuitable items',
      ]],
      ['Sales Contribution', 'Contribution towards individual and team sales targets.', [
        'A consistently strong contributor to the shop hitting target',
        'Contributes solidly to team performance',
        'Contribution is average and inconsistent',
        'Below what the shift and footfall should produce',
        'Makes no real contribution to sales',
      ]],
      ['Complaint Handling & Escalation', 'Managing difficult situations and escalating appropriately.', [
        'Defuses complaints calmly and knows exactly when to involve a supervisor',
        'Handles complaints well; escalates appropriately',
        'Manages simple complaints but escalates too readily or too late',
        'Complaints are mishandled or left unresolved',
        'Makes situations worse, or hides them from supervisors',
      ]],
    ]],
    ['Transactions & Cash', [
      ['Transaction Accuracy', 'Correct products, quantities, prices and discounts.', [
        'Transactions correct every time; discrepancies effectively nil',
        'Accurate; rare error caught and corrected',
        'Mostly accurate, with occasional pricing or quantity errors',
        'Errors frequent enough to require regular correction',
        'Persistent errors affecting customers and takings',
      ]],
      ['Cash Handling & Reconciliation', 'Correct amounts and change; accurate till balance at handover.', [
        'Till balances every time; shortages and excesses effectively nil',
        'Balances reliably; small differences rare and explained',
        'Balances most days, with occasional unexplained differences',
        'Recurring shortages or excesses',
        'Till cannot be relied on to balance',
      ]],
      ['POS & Payment Verification', 'Operating the POS and confirming card or transfer payments before release.', [
        'POS used fluently, and every electronic payment confirmed before goods are released',
        'Competent on POS; payments properly verified',
        'Competent, but verification is sometimes rushed',
        'Goods released before payment is confirmed',
        'Verification skipped, and the business has lost money as a result',
      ]],
      ['Refund, Discount & Receipt Compliance', 'Authorisation procedures for refunds, voids and discounts, and correct receipts.', [
        'Authorisation always obtained; receipts and records correct without exception',
        'Procedures followed reliably',
        'Procedures followed, but records are sometimes incomplete',
        'Discounts or voids processed without proper authorisation',
        'Procedures disregarded, leaving transactions unaccountable',
      ]],
    ]],
    ['Stock & Store Standards', [
      ['Stock Handling & Breakage Control', 'Careful handling of products; minimising breakages and damage.', [
        'Stock handled with evident care; breakages effectively nil',
        'Careful; very occasional breakage, reported',
        'Generally careful, but needs reminding around fragile items',
        'Avoidable breakages occur regularly',
        'Frequent breakage, sometimes unreported',
      ]],
      ['Shelf Arrangement, Display & Cleanliness', 'Keeping the assigned area arranged, presentable and clean.', [
        'Area consistently full, faced, priced and clean without being asked',
        'Well maintained; occasional gap',
        'Acceptable, but slips without reminders',
        'Area regularly untidy, with gaps or missing prices',
        'Area is left in a state that affects sales',
      ]],
    ]],
    ['Conduct & Commitment', [
      ['Following Company Procedures', 'Complying with operational, cash-control and company policies.', [
        'Procedures followed exactly, including when inconvenient or unobserved',
        'Complies reliably; occasional reminder needed',
        'Complies with the main rules but improvises on detail',
        'Procedures regularly bypassed',
        'Policy disregarded, including controls that exist to protect the business',
      ]],
      ['Teamwork', 'Cooperating with colleagues, supervisors and other shifts.', [
        'Actively helps colleagues and covers willingly; shares the load unasked',
        'Cooperates well and helps when asked',
        'Works alongside others but does not offer help',
        'Keeps to own duties and is reluctant to assist',
        'Creates friction, or leaves work for the next shift',
      ]],
      ['Integrity & Trustworthiness', 'Honesty with stock, money, customers and company property.', [
        'Complete trustworthiness; discrepancies disclosed unprompted and owned',
        'Honest and reliable; owns errors when they come up',
        'Honest when asked directly, but does not volunteer problems',
        'Explains away discrepancies, or waits to be asked',
        'Dishonesty with stock, money or company property',
      ]],
      ['Overall Attitude & Commitment', 'Positive attitude, willingness to work and commitment to the business.', [
        'Consistently disciplined, willing and positive; sets the tone for others',
        'Positive and dependable in approach to the work',
        'Does the job willingly, without particular energy either way',
        'Varies with mood or workload; needs occasional correction',
        'Resistant or unwilling, and it affects the rest of the team',
      ]],
    ]],
  ]],
];

function buildSections(departmentId, groups) {
  return groups.map(([title, rows]) => ({
    title,
    departments: [new mongoose.Types.ObjectId(departmentId)],
    questions: rows.map(([label, helpText, options]) => ({
      type: 'likert',
      label,
      helpText,
      required: true,
      scaleMax: 5,
      options,
      optionScores: SCORES,
      askOf: ['self', 'manager'],
    })),
  }));
}

async function main() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGO_URI is not set');
  await mongoose.connect(uri);

  const template = await AppraisalTemplate.findOne({ _id: TEMPLATE_ID, tenant: TENANT }).lean();
  if (!template) throw new Error(`Template ${TEMPLATE_ID} not found`);

  // Copy-on-write: an in-place edit is only legal while no launched cycle is
  // pinned to this version.
  if (await hasLaunchedCycleFor(template.tenant, template._id)) {
    throw new Error('A LAUNCHED cycle pins this template version — fork instead of editing in place.');
  }
  console.log(`Template: ${template.name} v${template.version} ${template._id}`);
  console.log(`Currently ${template.sections.length} sections, ${template.sections.reduce((n, s) => n + s.questions.length, 0)} criteria`);
  console.log('✓ no launched cycle pins this version\n');

  const present = new Set(
    template.sections.flatMap((s) => (s.departments || []).map(String))
  );

  const toAdd = [];
  for (const [departmentId, deptName, groups] of GROUPS) {
    const sections = buildSections(departmentId, groups);
    const count = sections.reduce((n, s) => n + s.questions.length, 0);
    if (present.has(String(departmentId))) {
      console.log(`= ${deptName.padEnd(26)} already present — skipping`);
      continue;
    }
    console.log(`+ ${deptName.padEnd(26)} ${sections.length} sections, ${count} criteria, scored ${count}–${count * 5}`);
    if (count !== 20) {
      throw new Error(`${deptName} has ${count} criteria, expected 20 — every sheet must total /100`);
    }
    toAdd.push(...sections);
  }

  if (toAdd.length === 0) {
    console.log('\nNothing to add.');
    await mongoose.disconnect();
    return;
  }

  // Validated with the EXISTING sections too, so this cannot create a document
  // the editor would then refuse to save.
  const errors = validateTemplateShape([...template.sections, ...toAdd]);
  if (errors.length) {
    console.error('\nShape invalid:\n');
    for (const e of errors) console.error(`  ✗ ${e}`);
    await mongoose.disconnect();
    process.exit(1);
  }
  console.log('\n✓ shape valid across the whole template');

  if (!APPLY) {
    console.log('\nDry run — nothing written. Re-run with --apply to write.');
    await mongoose.disconnect();
    return;
  }

  // $push, never a rebuilt array: the existing sections and every question
  // `_id` beneath them are left untouched. Rebuilding to "update" would remint
  // them and orphan any stored answer.
  await AppraisalTemplate.updateOne(
    { _id: template._id, tenant: template.tenant },
    { $push: { sections: { $each: toAdd } }, $set: { name: NEW_NAME } }
  );

  const fresh = await AppraisalTemplate.findById(template._id).lean();
  const before = new Set(template.sections.flatMap((s) => s.questions.map((q) => String(q._id))));
  const stillThere = [...before].filter((id) =>
    fresh.sections.some((s) => s.questions.some((q) => String(q._id) === id))
  ).length;

  console.log(`\nApplied. Renamed to "${fresh.name}".`);
  console.log(`${stillThere === before.size ? '✓' : '✗'} identity: ${stillThere}/${before.size} pre-existing question _ids unchanged`);
  console.log(`✓ now ${fresh.sections.length} sections, ${fresh.sections.reduce((n, s) => n + s.questions.length, 0)} criteria`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
