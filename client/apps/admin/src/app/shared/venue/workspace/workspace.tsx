'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { RotateCcw } from 'lucide-react';
import WorkspaceNavigation, { type Tab } from './workspace-navigation';
import { venueToolHref } from './tool-search';
import { buttonClass, EmptyState, Notice } from './controls';
import {
  experienceRequest,
  type Workspace,
  type Profile,
  type Menu,
  type Floor,
  type RequestRow,
  type Candidate,
} from '@/services/venue/experience';
import WorkspaceOverview from './workspace-overview';
import ProfileEditor from './profile-editor';
import MenuSetup from './menu-setup';
import ServingEditor from './serving-editor';
import ProductionPanel from './production-panel';
import InventoryCountPanel from './inventory-count-panel';
import ProfitabilityPanel from './profitability-panel';
import ReceiptCostSources from './receipt-cost-sources';
import RecipesEditor from './recipes-editor';
import FloorEditor from './floor-editor';
import FloorOps from './floor-ops';
import StationsEditor from './stations-editor';
import CoursesPanel from './courses-panel';
import DoorPanel from './door-panel';
import WaitlistPanel from './waitlist-panel';
import PackagesEditor from './packages-editor';
import PackageCommitments from './package-commitments';
import RequestQueue from './request-queue';
import MoneyCases from './money-cases';
import MoneyPolicyEditor from './money-policy-editor';
import CapacitySettings from './capacity-settings';
import Practice from './practice';
import VenueCheckout from '../venue-checkout';
import VenueServingOrder from '../venue-serving-order';
/**
 * Tools only managers can use. A deep link to one of these is shown to
 * non-manager accounts as the overview instead of a blank content panel.
 */
const manageTabs: Tab[] = ['profile', 'menu', 'recipes', 'floor', 'floor-ops', 'capacity', 'money', 'stations', 'courses', 'servings', 'production', 'profitability', 'counts', 'cost-sources'];
export default function VenueWorkspace({
  initialTool,
}: {
  /** Tool restored from the `?tool=` deep link (validated by resolveVenueTool). */
  initialTool?: Tab;
}) {
  const { data: session } = useSession();
  const token = session?.user?.token || '';
  const [locations, setLocations] = useState<{ id: string; name: string }[]>(
    [],
  );
  const [location, setLocation] = useState('');
  const [data, setData] = useState<Workspace | null>(null);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [nextRequests, setNextRequests] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<Candidate[]>([]);
  const [nextCatalog, setNextCatalog] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>(initialTool || 'overview');
  const [checkout, setCheckout] = useState('');
  const [checkoutRevision, setCheckoutRevision] = useState(0);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const sequence = useRef(0);
  /**
   * Keep the selected tool in the URL (replaceState) so refresh and back
   * restore it. Client-only guard keeps this SSR-safe; no effect loops are
   * possible because the URL is only written from user actions.
   */
  const selectTab = useCallback((next: Tab) => {
    setTab(next);
    if (typeof window !== 'undefined')
      window.history.replaceState(null, '', venueToolHref(next));
  }, []);
  useEffect(() => {
    if (!token) return;
    let active = true;
    experienceRequest<{ id: string; name: string }[]>(token, '/locations')
      .then((rows) => {
        if (active) {
          setLocations(rows);
          setLocation(rows[0]?.id || '');
        }
      })
      .catch((e) => {
        if (active)
          setError(e instanceof Error ? e.message : 'Unable to load locations');
      });
    return () => {
      active = false;
    };
  }, [token]);
  const load = useCallback(async () => {
    if (!token || !location) return;
    const current = ++sequence.current;
    setError('');
    setData(null);
    setCheckout('');
    try {
      const [workspace, queue] = await Promise.all([
        experienceRequest<Workspace>(token, `/locations/${location}`),
        experienceRequest<{ items: RequestRow[]; next: string | null }>(
          token,
          `/locations/${location}/requests`,
        ),
      ]);
      if (current !== sequence.current) return;
      setData(workspace);
      setRequests(queue.items);
      setNextRequests(queue.next);
      if (workspace.canManage) {
        const choices = await experienceRequest<{
          items: Candidate[];
          next: string | null;
        }>(token, `/locations/${location}/catalog`);
        if (current === sequence.current) {
          setCatalog(choices.items);
          setNextCatalog(choices.next);
        }
      }
    } catch (e) {
      if (current === sequence.current)
        setError(e instanceof Error ? e.message : 'Unable to load venue');
    }
  }, [token, location]);
  useEffect(() => {
    void load();
    return () => {
      sequence.current += 1;
    };
  }, [load]);
  async function save(kind: Tab, input: Profile | Menu | Floor) {
    if (!data || busy) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const config = await experienceRequest<Workspace['config']>(
        token,
        `/locations/${location}/${kind}`,
        'PUT',
        { expectedVersion: data.config.version, input },
      );
      setData({ ...data, config });
      setMessage('Changes saved. Public profile approval remains separate.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to save');
    } finally {
      setBusy(false);
    }
  }
  async function action(row: RequestRow, command: string, extra: unknown = {}) {
    if (busy) return false;
    setBusy(true);
    setError('');
    try {
      await experienceRequest(
        token,
        `/locations/${location}/requests/${row.id}/${command}`,
        'POST',
        { expectedVersion: row.version, ...(extra as object) },
      );
      await load();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to update request');
      return false;
    } finally {
      setBusy(false);
    }
  }
  const moreRequests = async () => {
    if (!nextRequests) return;
    try {
      const page = await experienceRequest<{
        items: RequestRow[];
        next: string | null;
      }>(token, `/locations/${location}/requests?after=${nextRequests}`);
      setRequests([...requests, ...page.items]);
      setNextRequests(page.next);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load requests');
    }
  };
  const moreCatalog = async () => {
    if (!nextCatalog) return;
    try {
      const page = await experienceRequest<{
        items: Candidate[];
        next: string | null;
      }>(token, `/locations/${location}/catalog?after=${nextCatalog}`);
      setCatalog([...catalog, ...page.items]);
      setNextCatalog(page.next);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load menu choices');
    }
  };
  const preset = data?.config.profile?.types[0] || 'venue';
  const title = `${preset.charAt(0).toUpperCase() + preset.slice(1)} workspace`;
  // Non-managers have no configuration tools; redirect a deep-linked manage
  // tool to the overview so the panel is never blank.
  const activeTab: Tab =
    data && !data.canManage && manageTabs.includes(tab) ? 'overview' : tab;
  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h1 className="text-2xl font-semibold">{title}</h1>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Review arrivals, run the floor and reconcile visits for the
            selected venue location.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="block text-sm font-medium">
            Location
            <select
              className="mt-1 min-h-11 rounded-lg border border-muted bg-transparent px-3 py-2 text-sm transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none dark:text-gray-100 sm:w-64"
              value={location}
              disabled={busy}
              onChange={(e) => {
                setLocation(e.target.value);
                setMessage('');
                // A different venue starts at the overview tool and clears
                // any ?tool= deep link.
                selectTab('overview');
              }}
            >
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => void load()}
            className={buttonClass}
            disabled={busy}
          >
            <RotateCcw
              aria-hidden="true"
              className={`size-4 ${busy ? 'motion-safe:animate-spin' : ''}`}
            />
            Reload venue status
          </button>
        </div>
      </div>
      {error && (
        <Notice
          tone="error"
          role="alert"
          action={
            location ? (
              <button
                type="button"
                onClick={() => void load()}
                disabled={busy}
                className={buttonClass}
              >
                Retry loading venue
              </button>
            ) : undefined
          }
        >
          {error}
        </Notice>
      )}
      {message && (
        <Notice tone="success" role="status">
          {message}
        </Notice>
      )}
      {!location && !error && (
        <EmptyState message="No permitted venue locations are available for this account." />
      )}
      {location && !data && !error && (
        <div className="space-y-3" role="status">
          <div className="h-4 w-56 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
          <div className="h-28 animate-pulse rounded-xl border border-muted bg-gray-100 dark:border-gray-700 dark:bg-gray-800" />
        </div>
      )}
      {data && (
        <>
          <WorkspaceNavigation
            tab={activeTab}
            onTab={selectTab}
            canManage={data.canManage}
            preparation={data.capabilities?.includes('preparation') === true}
          />
          {activeTab === 'overview' && (
            <>
              <WorkspaceOverview data={data} onOpen={setCheckout}>
                <RequestQueue
                  rows={requests}
                  tables={data.tables}
                  canManage={data.canReview ?? data.canManage}
                  canSeat={data.canonicalCheckoutEnabled}
                  busy={busy}
                  onAction={action}
                  onAvailability={data.capacityEnabled?row=>experienceRequest(token,`/locations/${location}/capacity/availability?bookingAt=${encodeURIComponent(row.bookingAt)}&partySize=${row.partySize}`):undefined}
                  more={!!nextRequests}
                  onMore={() => void moreRequests()}
                />
              </WorkspaceOverview>
              {checkout && (
                <><VenueServingOrder token={token} sessionId={checkout} onChanged={()=>setCheckoutRevision(value=>value+1)}/><VenueCheckout
                  key={`${checkout}:${checkoutRevision}`}
                  token={token}
                  sessionId={checkout}
                /></>
              )}
            </>
          )}
          {activeTab === 'profile' && data.canManage && (
            <ProfileEditor
              key={`${location}:${data.config.profileVersion}`}
              value={data.config.profile}
              onSave={(input) => save('profile', input)}
              busy={busy}
            />
          )}
          {activeTab === 'menu' && data.canManage && (
            <MenuSetup
              token={token} locationId={location}
              key={location}
              value={data.config.menu}
              catalog={catalog}
              more={!!nextCatalog}
              onMore={() => void moreCatalog()}
              onSave={(input) => save('menu', input)}
              busy={busy}
            />
          )}
          {activeTab === 'servings' && data.canManage && <ServingEditor key={location} token={token} locationId={location} catalog={catalog}/>}
          {activeTab === 'production' && data.canManage && <ProductionPanel key={location} token={token} locationId={location} catalog={catalog}/>}
          {activeTab === 'cost-sources' && data.canManage && <ReceiptCostSources key={location} token={token} locationId={location}/>}
          {activeTab === 'counts' && data.canManage && <InventoryCountPanel key={location} token={token} locationId={location} catalog={catalog}/>}
          {activeTab === 'profitability' && data.canManage && <ProfitabilityPanel key={location} token={token} locationId={location}/>}
          {activeTab === 'recipes' && data.canManage && (
            <RecipesEditor
              key={location}
              token={token}
              locationId={location}
              menu={data.config.menu}
              catalog={catalog}
            />
          )}
          {activeTab==='floor' && data.canManage && (
            <FloorEditor
              key={location}
              value={data.config.floor}
              tables={data.tables}
              onSave={(input) => save('floor', input)}
              busy={busy}
            />
          )}
          {activeTab==='floor-ops'&&data.canManage&&<FloorOps key={location} token={token} visits={data.visits.map(v=>({_id:v._id,state:v.state}))} tables={data.tables} onChanged={load}/>}
          {activeTab==='money'&&data.canManage&&<><MoneyPolicyEditor/><MoneyCases key={location} token={token} locationId={location}/></>}
          {activeTab==='stations'&&data.canManage&&<StationsEditor key={location} token={token} locationId={location} visits={data.visits.map(v=>({_id:v._id,state:v.state}))}/>}
          {activeTab==='courses'&&data.canManage&&<CoursesPanel key={location} token={token} visits={data.visits.map(v=>({_id:v._id,state:v.state}))}/>}
          {activeTab==='door'&&<DoorPanel key={location} token={token} locationId={location}/>}
          {activeTab==='waitlist'&&<WaitlistPanel key={location} token={token} locationId={location}/>}
          {activeTab==='packages'&&(
            <div className="space-y-3">
              {data.canManage&&<PackagesEditor key={location} token={token} locationId={location} catalog={catalog}/>}
              <PackageCommitments key={`${location}-floor`} token={token} locationId={location}/>
            </div>
          )}
          {activeTab==='capacity'&&data.canManage&&<CapacitySettings key={location} token={token} locationId={location} timezone={data.config.profile?.timezone||'Africa/Lagos'} tables={data.tables}/>}
          {activeTab === 'practice' && (
            <Practice
              scope={`${session?.user?.id || ''}:${location}:${data.config.version}`}
            />
          )}
        </>
      )}
    </main>
  );
}
