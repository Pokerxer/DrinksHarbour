import {
  PiHouseBold,
  PiSparkle,
  PiMonitorBold,
  PiTShirtBold,
  PiForkKnifeBold,
  PiArmchairBold,
} from 'react-icons/pi';
import { industriesForProductType } from '@/utils/industries';

const icons = {
  home: PiHouseBold,
  beauty: PiSparkle,
  electronics: PiMonitorBold,
  fashion: PiTShirtBold,
  'food-service': PiForkKnifeBold,
  hospitality: PiArmchairBold,
};
export function businessIcon(type?: string) {
  const industry = industriesForProductType(type);
  return industry && industry !== 'beverage' ? icons[industry] : undefined;
}
