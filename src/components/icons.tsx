import type { SVGProps } from 'react';

/**
 * Hand-authored icon set (no external icon package — this app runs fully
 * offline). Consistent 24x24 stroke style, currentColor, 1.75 stroke width.
 */
type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function base(props: IconProps) {
  const { size = 20, ...rest } = props;
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.75,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    ...rest,
  };
}

export const IconSearch = (p: IconProps) => (
  <svg {...base(p)}><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
);
export const IconBuilding = (p: IconProps) => (
  <svg {...base(p)}><rect x="4" y="3" width="12" height="18" rx="1" /><path d="M16 8h4v13h-4" /><path d="M7.5 7h1M11.5 7h1M7.5 11h1M11.5 11h1M7.5 15h1M11.5 15h1" /></svg>
);
export const IconBed = (p: IconProps) => (
  <svg {...base(p)}><path d="M3 18v-6.5A1.5 1.5 0 0 1 4.5 10H11a1.5 1.5 0 0 1 1.5 1.5V18" /><path d="M12.5 13H19a2 2 0 0 1 2 2v3" /><path d="M3 15h18" /><path d="M3 18v2M21 18v2" /><circle cx="7" cy="13" r="1.1" /></svg>
);
export const IconDroplet = (p: IconProps) => (
  <svg {...base(p)}><path d="M12 3.5s6 6.7 6 11a6 6 0 1 1-12 0c0-4.3 6-11 6-11Z" /></svg>
);
export const IconFlame = (p: IconProps) => (
  <svg {...base(p)}><path d="M12 3s-1 3-3.5 5.5C6.3 10.7 6 13 6 14.5a6 6 0 0 0 12 0c0-2-.8-3.4-1.8-4.6-.2 1.5-1 2.3-1.7 2.6C15 10 14 7.5 12 3Z" /></svg>
);
export const IconZap = (p: IconProps) => (
  <svg {...base(p)}><path d="M12.5 3 5 13.5h5.5L11 21l7.5-10.5H13l-.5-7.5Z" /></svg>
);
export const IconBox = (p: IconProps) => (
  <svg {...base(p)}><path d="M3.5 7.5 12 3l8.5 4.5V16.5L12 21l-8.5-4.5Z" /><path d="M3.5 7.5 12 12l8.5-4.5" /><path d="M12 12v9" /></svg>
);
export const IconTruck = (p: IconProps) => (
  <svg {...base(p)}><rect x="2.5" y="7" width="11" height="9" rx="1" /><path d="M13.5 10h4l3 3v3h-7" /><circle cx="6.5" cy="18" r="1.6" /><circle cx="16.5" cy="18" r="1.6" /></svg>
);
export const IconCamera = (p: IconProps) => (
  <svg {...base(p)}><path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" /><circle cx="12" cy="13.5" r="3.4" /></svg>
);
export const IconWrench = (p: IconProps) => (
  <svg {...base(p)}><path d="M14.5 6.5a3.8 3.8 0 0 0 4.9 4.9l-2.2-2.2 1.4-1.4 2.2 2.2A3.8 3.8 0 0 0 15 3.9l2.2 2.2-1.4 1.4-2.2-2.2A3.8 3.8 0 0 0 14.5 6.5Z" /><path d="M13 9 4.5 17.5a2 2 0 1 0 2 2L15 11" /></svg>
);
export const IconUsers = (p: IconProps) => (
  <svg {...base(p)}><circle cx="9" cy="8" r="3" /><path d="M2.5 19.5c1-3 3.4-4.6 6.5-4.6s5.5 1.6 6.5 4.6" /><path d="M16 4.2a3 3 0 0 1 0 5.8" /><path d="M15.5 15c2.6.3 4.2 1.8 5 4.5" /></svg>
);
export const IconUser = (p: IconProps) => (
  <svg {...base(p)}><circle cx="12" cy="8" r="3.5" /><path d="M4.5 20c1.2-3.6 4-5.5 7.5-5.5s6.3 1.9 7.5 5.5" /></svg>
);
export const IconCreditCard = (p: IconProps) => (
  <svg {...base(p)}><rect x="2.5" y="5" width="19" height="14" rx="2.2" /><path d="M2.5 10h19" /><path d="M6 15h4" /></svg>
);
export const IconCash = (p: IconProps) => (
  <svg {...base(p)}><rect x="2.5" y="6" width="19" height="12" rx="2" /><circle cx="12" cy="12" r="3" /><path d="M6 9v0M18 15v0" /></svg>
);
export const IconFileText = (p: IconProps) => (
  <svg {...base(p)}><path d="M7 3.5h7l4 4v13h-11Z" /><path d="M14 3.5v4h4" /><path d="M9.5 12.5h5M9.5 15.5h5M9.5 9.5h2" /></svg>
);
export const IconLayoutDashboard = (p: IconProps) => (
  <svg {...base(p)}><rect x="3.5" y="3.5" width="8" height="9" rx="1.3" /><rect x="13.5" y="3.5" width="7" height="5" rx="1.3" /><rect x="13.5" y="10.5" width="7" height="10" rx="1.3" /><rect x="3.5" y="14.5" width="8" height="6" rx="1.3" /></svg>
);
export const IconSettings = (p: IconProps) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="3" /><path d="M19.4 13a7.6 7.6 0 0 0 0-2l2-1.5-2-3.4-2.4 1a7.7 7.7 0 0 0-1.7-1L15 3h-6l-.3 2.6a7.7 7.7 0 0 0-1.7 1l-2.4-1-2 3.4L4.6 11a7.6 7.6 0 0 0 0 2l-2 1.5 2 3.4 2.4-1c.5.4 1.1.8 1.7 1L9 21h6l.3-2.6c.6-.2 1.2-.6 1.7-1l2.4 1 2-3.4-2-1.5Z" /></svg>
);
export const IconShield = (p: IconProps) => (
  <svg {...base(p)}><path d="M12 3.5 19.5 6.5v5.5c0 5-3.3 7.8-7.5 9-4.2-1.2-7.5-4-7.5-9V6.5Z" /><path d="M9 12l2.2 2.2L15.5 9.5" /></svg>
);
export const IconGauge = (p: IconProps) => (
  <svg {...base(p)}><path d="M4 15a8 8 0 1 1 16 0" /><path d="M12 15l4-4" /><circle cx="12" cy="15" r="1.2" fill="currentColor" stroke="none" /></svg>
);
export const IconMapPin = (p: IconProps) => (
  <svg {...base(p)}><path d="M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11Z" /><circle cx="12" cy="10" r="2.6" /></svg>
);
export const IconCheck = (p: IconProps) => (<svg {...base(p)}><path d="M4 12.5l5.2 5.2L20 6.5" /></svg>);
export const IconCheckCircle = (p: IconProps) => (<svg {...base(p)}><circle cx="12" cy="12" r="9" /><path d="M8 12.3l2.6 2.6L16 9" /></svg>);
export const IconX = (p: IconProps) => (<svg {...base(p)}><path d="M5 5l14 14M19 5L5 19" /></svg>);
export const IconXCircle = (p: IconProps) => (<svg {...base(p)}><circle cx="12" cy="12" r="9" /><path d="M9 9l6 6M15 9l-6 6" /></svg>);
export const IconChevronDown = (p: IconProps) => (<svg {...base(p)}><path d="M6 9l6 6 6-6" /></svg>);
export const IconChevronRight = (p: IconProps) => (<svg {...base(p)}><path d="M9 6l6 6-6 6" /></svg>);
export const IconChevronLeft = (p: IconProps) => (<svg {...base(p)}><path d="M15 6l-6 6 6 6" /></svg>);
export const IconArrowLeft = (p: IconProps) => (<svg {...base(p)}><path d="M19 12H5M5 12l6-6M5 12l6 6" /></svg>);
export const IconArrowRight = (p: IconProps) => (<svg {...base(p)}><path d="M5 12h14M13 6l6 6-6 6" /></svg>);
export const IconAlertTriangle = (p: IconProps) => (<svg {...base(p)}><path d="M12 4.5 21.5 20h-19L12 4.5Z" /><path d="M12 10v4.2" /><circle cx="12" cy="17.4" r="0.15" fill="currentColor" /></svg>);
export const IconAlertCircle = (p: IconProps) => (<svg {...base(p)}><circle cx="12" cy="12" r="9" /><path d="M12 7.5v5.5" /><circle cx="12" cy="16.5" r="0.15" fill="currentColor" /></svg>);
export const IconInfo = (p: IconProps) => (<svg {...base(p)}><circle cx="12" cy="12" r="9" /><path d="M12 10.8v5.7" /><circle cx="12" cy="7.7" r="0.15" fill="currentColor" /></svg>);
export const IconTrendingUp = (p: IconProps) => (<svg {...base(p)}><path d="M3 17l6.5-6.5 4 4L21 6" /><path d="M15 6h6v6" /></svg>);
export const IconClock = (p: IconProps) => (<svg {...base(p)}><circle cx="12" cy="12" r="9" /><path d="M12 7v5.3l3.5 2" /></svg>);
export const IconMoon = (p: IconProps) => (<svg {...base(p)}><path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z" /></svg>);
export const IconSun = (p: IconProps) => (<svg {...base(p)}><circle cx="12" cy="12" r="4.2" /><path d="M12 2.5v2.3M12 19.2v2.3M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.5 12h2.3M19.2 12h2.3M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6" /></svg>);
export const IconMenu = (p: IconProps) => (<svg {...base(p)}><path d="M4 6.5h16M4 12h16M4 17.5h16" /></svg>);
export const IconPrinter = (p: IconProps) => (<svg {...base(p)}><path d="M6.5 8.5V3.5h11v5" /><rect x="3.5" y="8.5" width="17" height="8" rx="1.6" /><path d="M6.5 15.5h11v5h-11Z" /></svg>);
export const IconPlus = (p: IconProps) => (<svg {...base(p)}><path d="M12 5v14M5 12h14" /></svg>);
export const IconMinus = (p: IconProps) => (<svg {...base(p)}><path d="M5 12h14" /></svg>);
export const IconTrash = (p: IconProps) => (<svg {...base(p)}><path d="M4 7h16" /><path d="M9 7V4.8c0-.4.4-.8.9-.8h4.2c.5 0 .9.4.9.8V7" /><path d="M6.5 7 7.3 19.4c0 .9.8 1.6 1.7 1.6h6c.9 0 1.6-.7 1.7-1.6L17.5 7" /><path d="M10 11v6M14 11v6" /></svg>);
export const IconLogOut = (p: IconProps) => (<svg {...base(p)}><path d="M9 4H5.8A1.8 1.8 0 0 0 4 5.8v12.4A1.8 1.8 0 0 0 5.8 20H9" /><path d="M15.5 16 20 12l-4.5-4" /><path d="M20 12H9" /></svg>);
export const IconEdit = (p: IconProps) => (<svg {...base(p)}><path d="M4 20h4L18.5 9.5a2 2 0 0 0 0-2.8l-1.2-1.2a2 2 0 0 0-2.8 0L4 16v4Z" /><path d="M13.5 6.5l4 4" /></svg>);
export const IconEye = (p: IconProps) => (<svg {...base(p)}><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="2.6" /></svg>);
export const IconDatabase = (p: IconProps) => (<svg {...base(p)}><ellipse cx="12" cy="6" rx="7.5" ry="2.8" /><path d="M4.5 6v12c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8V6" /><path d="M4.5 12c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8" /></svg>);
export const IconClipboard = (p: IconProps) => (<svg {...base(p)}><rect x="6" y="4.5" width="12" height="16" rx="1.6" /><rect x="9" y="3" width="6" height="3" rx="1" /><path d="M9 11h6M9 14.5h6M9 18h4" /></svg>);
export const IconTag = (p: IconProps) => (<svg {...base(p)}><path d="M12.6 3H6a2 2 0 0 0-2 2v6.6c0 .5.2 1 .6 1.4l9 9c.8.8 2 .8 2.8 0l6.2-6.2c.8-.8.8-2 0-2.8l-9-9c-.4-.4-.9-.6-1.4-.6Z" /><circle cx="8.2" cy="8.2" r="1.4" fill="currentColor" stroke="none" /></svg>);
export const IconMoreHorizontal = (p: IconProps) => (<svg {...base(p)}><circle cx="5.5" cy="12" r="1.2" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" /><circle cx="18.5" cy="12" r="1.2" fill="currentColor" stroke="none" /></svg>);
export const IconRefresh = (p: IconProps) => (<svg {...base(p)}><path d="M4 12a8 8 0 0 1 13.7-5.6L20 8" /><path d="M20 4v4h-4" /><path d="M20 12a8 8 0 0 1-13.7 5.6L4 16" /><path d="M4 20v-4h4" /></svg>);
export const IconCalendar = (p: IconProps) => (<svg {...base(p)}><rect x="3.5" y="5" width="17" height="16" rx="2" /><path d="M3.5 9.5h17M8 3v4M16 3v4" /></svg>);
export const IconClipboardList = (p: IconProps) => (<svg {...base(p)}><rect x="6" y="4.5" width="12" height="16" rx="1.6" /><rect x="9" y="3" width="6" height="3" rx="1" /><path d="M9 11.2h.01M9 14.7h.01M9 18.2h.01" /><path d="M11.5 11.2h4.5M11.5 14.7h4.5M11.5 18.2h3" /></svg>);
