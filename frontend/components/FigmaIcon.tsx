/* eslint-disable @next/next/no-img-element */
const icons = {
  search: '25-29571-imgSearch.svg', school: '25-29571-imgSchool.svg', graduation: '25-29571-imgGraduationCap.svg',
  arrow: '25-29617-imgCategoryIcon1.svg', arrowWhite: '25-29571-imgArrowRight.svg', arrowUp: '25-29617-imgArrowUpRight.svg', chevron: '25-29571-imgChevronDown.svg',
  plus: '25-29571-imgPlus.svg', refresh: '25-29571-imgRefreshCw.svg', pin: '25-29617-imgCategoryIcon.svg',
  heart: '25-29617-imgCategoryIcon3.svg', chat: '25-29617-imgCategoryIcon2.svg', chatWhite: '27-62173-imgMessageCircle.svg', shield: '27-62173-imgShieldCheck.svg',
  grid: '25-29617-imgGrid2X2.svg', book: '25-29617-imgBookOpen.svg', laptop: '25-29617-imgLaptop.svg',
  home: '25-29617-imgHouse.svg', shirt: '25-29617-imgShirt.svg', sparkles: '25-29617-imgShapes.svg', filter: '25-29617-imgSlidersHorizontal.svg',
  expand: '27-62173-imgExpand.svg', back: '27-63365-imgArrowLeft.svg', more: '27-63365-imgEllipsis.svg',
  image: '27-64744-imgImagePlus.svg', upload: '27-64744-imgUpload.svg', trash: '27-64744-imgTrash2.svg', grip: '27-64744-imgGripVertical.svg',
  calendar: '27-63365-imgCalendarPlus.svg', send: '27-63365-imgSend.svg', attachment: '27-63365-imgPaperclip.svg',
  pencil: '27-66090-imgPencil.svg', eye: '27-66090-imgEye.svg', check: '27-66090-imgCheck.svg',
  money: '27-65319-imgBanknote.svg', exchange: '27-65319-imgRepeat2.svg', gift: '27-65319-imgGift.svg',
  close: '27-67322-imgX.svg', login: '27-67322-imgLogIn.svg', alert: '27-67322-imgCircleAlert.svg',
} as const;
export type FigmaIconName = keyof typeof icons;
export default function FigmaIcon({ name, size = 20 }: { name: FigmaIconName; size?: number }) {
  return <img className="figma-icon" src={`/figma/${icons[name]}`} width={size} height={size} alt="" aria-hidden="true" />;
}
