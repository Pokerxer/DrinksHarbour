'use client';

/**
 * Create / edit a CUSTOM role. System roles are intentionally absent — their
 * permission set is policy, pinned server-side by rolePermissionMap.test.js.
 *
 * Scope is fixed by the audience (tenant callers create tenant roles; platform
 * admins platform ones) and never sent as an editable field.
 *
 * A live "n of m selected" counter with a clear-all action sits above the
 * matrix so the consequence of checkbox clicks is always visible.
 */

import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { ActionIcon, Button, Input, Text, Textarea, Title } from 'rizzui';
import { PiXBold } from 'react-icons/pi';

import cn from '@core/utils/class-names';
import PermissionMatrix from '@/app/shared/roles-permissions/permission-matrix';
import { useAuthorization } from '@/hooks/use-authorization';
import type { CustomRole } from '@/types/authorization';
import {
  rolesService,
  type GroupedCatalog,
  type RoleInput,
} from '@/services/roles.service';

interface Props {
  open: boolean;
  editing: CustomRole | null;
  audience: 'platform' | 'tenant';
  catalog: GroupedCatalog[];
  platformOnly: string[];
  onClose: () => void;
  onSaved: () => void;
}

const COLOR_PRESETS = [
  '#7c3aed',
  '#2563eb',
  '#04873c',
  '#79b829',
  '#eeaa44',
  '#e14446',
];

export default function CreateEditRoleModal({
  open,
  editing,
  audience,
  catalog,
  platformOnly,
  onClose,
  onSaved,
}: Props) {
  const { user } = useAuthorization();
  const token = user?.token;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(COLOR_PRESETS[1]);
  const [permissions, setPermissions] = useState<CustomRole['permissions']>([]);
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState<string | undefined>(undefined);

  const isEdit = Boolean(editing);

  // Hydrate the form each time the modal opens for a different target.
  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? '');
    setDescription(editing?.description ?? '');
    setColor(editing?.color || COLOR_PRESETS[1]);
    setPermissions(editing?.permissions ?? []);
    setNameError(undefined);
  }, [open, editing]);

  const effectivePlatformOnly = useMemo(
    () => (audience === 'tenant' ? platformOnly : []),
    [audience, platformOnly]
  );

  const totalPermissions = useMemo(
    () =>
      catalog.reduce((sum, group) => sum + group.permissions.length, 0),
    [catalog]
  );

  if (!open) return null;

  const submit = async () => {
    if (!token) return;
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError('Give the role a name');
      return;
    }
    setSaving(true);
    try {
      const payload: RoleInput = {
        name: trimmed,
        description: description.trim(),
        color,
        permissions,
        scope: audience,
      };
      if (isEdit && editing) {
        await rolesService.updateRole(editing._id, payload, token);
        toast.success(`Role "${trimmed}" updated`);
      } else {
        await rolesService.createRole(payload, token);
        toast.success(`Role "${trimmed}" created`);
      }
      onClose();
      onSaved();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-5 sm:p-6">
      <div className="mb-5 flex items-center justify-between gap-3">
        <Title as="h4" className="font-semibold dark:text-white">
          {isEdit ? `Edit ${editing?.name}` : 'Create a custom role'}
        </Title>
        <ActionIcon size="sm" variant="text" onClick={onClose} aria-label="Close">
          <PiXBold className="h-auto w-5" />
        </ActionIcon>
      </div>

      <div className="grid grid-cols-1 gap-5 @container md:grid-cols-2">
        <Input
          label="Role Name"
          placeholder="e.g. Shift Lead"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (nameError) setNameError(undefined);
          }}
          error={nameError}
          inputClassName="dark:bg-gray-900 dark:text-gray-100"
        />

        <div>
          <Text className="mb-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">
            Colour
          </Text>
          <div className="flex flex-wrap items-center gap-2 pt-1.5">
            {COLOR_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                aria-label={`Use colour ${preset}`}
                aria-pressed={color === preset}
                onClick={() => setColor(preset)}
                className={cn(
                  'h-8 w-8 rounded-full border-2 transition-transform focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
                  color === preset
                    ? 'scale-110 border-gray-900 dark:border-white'
                    : 'border-transparent'
                )}
                style={{ backgroundColor: preset }}
              />
            ))}
          </div>
        </div>

        <Textarea
          label="Description"
          placeholder="What can people with this role do?"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="col-span-full"
          textareaClassName="dark:bg-gray-900 dark:text-gray-100"
          rows={2}
          maxLength={500}
        />
      </div>

      <div className="mt-6 rounded-xl border border-gray-200 dark:border-gray-700">
        <div className="sticky top-0 z-[1] flex items-center justify-between gap-3 rounded-t-xl border-b border-gray-100 bg-gray-50 px-4 py-2.5 dark:border-gray-700 dark:bg-gray-800">
          <Text className="text-xs font-semibold text-gray-600 dark:text-gray-300">
            Permissions ·{' '}
            <span className="tabular-nums">
              {permissions.length} of {totalPermissions}
            </span>{' '}
            selected
          </Text>
          {permissions.length > 0 && (
            <Button
              size="sm"
              variant="text"
              onClick={() => setPermissions([])}
              className="h-7 px-2 text-xs font-medium text-gray-500 hover:!text-red-600 dark:hover:!text-red-400"
            >
              Clear all
            </Button>
          )}
        </div>
        <div className="max-h-[40vh] overflow-y-auto p-4">
          <PermissionMatrix
            catalog={catalog}
            mode="editable"
            value={permissions}
            onChange={setPermissions}
            platformOnly={effectivePlatformOnly}
          />
        </div>
      </div>

      <Text className="mt-3 block text-xs leading-relaxed text-gray-500 dark:text-gray-400">
        A custom role ADDS to what its holder&apos;s system role already allows —
        it never removes anything. Permissions gate screens today; deeper
        per-route enforcement is on the platform roadmap.
      </Text>

      <div className="mt-6 flex flex-col-reverse items-stretch justify-end gap-3 @xl:flex-row @xl:items-center @xl:gap-4">
        <Button variant="outline" onClick={onClose} className="w-full @xl:w-auto">
          Cancel
        </Button>
        <Button
          type="button"
          isLoading={saving}
          onClick={submit}
          className="w-full @xl:w-auto"
        >
          {isEdit ? 'Save Changes' : 'Create Role'}
        </Button>
      </div>
    </div>
  );
}
