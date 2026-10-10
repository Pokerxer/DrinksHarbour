import NotificationFeatureHeader from '../notification-feature-header';
export default function PerformanceHeader(props: {
  warehouse: string;
  period?: string;
  updatedAt?: string;
  loading: boolean;
  refresh: () => void;
}) {
  return (
    <NotificationFeatureHeader
      {...props}
      title="Sales performance"
      description="Find your best sellers and see where sales are changing."
      period={props.period || 'Customer net sales · 30 completed days'}
    />
  );
}
