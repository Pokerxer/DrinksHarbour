import PageHeader from '@/app/shared/page-header';
import RolesPermissionsView, {
  RoleHeaderAction,
} from '@/app/shared/roles-permissions/roles-permissions-view';

const pageHeader = {
  title: 'Roles and Permissions',
  breadcrumb: [
    {
      href: '/',
      name: 'Dashboard',
    },
    {
      name: 'Role Management & Permission',
    },
  ],
};

export default function RolesPermissionsPage() {
  return (
    <>
      <PageHeader title={pageHeader.title} breadcrumb={pageHeader.breadcrumb}>
        <RoleHeaderAction />
      </PageHeader>
      <RolesPermissionsView />
    </>
  );
}
