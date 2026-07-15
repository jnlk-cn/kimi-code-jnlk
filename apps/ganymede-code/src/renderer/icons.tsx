import type { ComponentType, ReactElement, SVGAttributes } from 'react';
import type { SFIconProps } from 'sf-symbols-lib/monochrome';
import {
  SFAppleTerminal,
  SFArchivebox,
  SFArrowClockwise,
  SFArrowLeftArrowRight,
  SFArrowTriangleheadBranch,
  SFArrowTriangleheadPull,
  SFArrowUp,
  SFArrowUpLeftAndArrowDownRight,
  SFArrowUpToLine,
  SFAt,
  SFBookmark,
  SFBrainHeadProfile,
  SFBubbleLeft,
  SFCheckmark,
  SFCheckmarkShield,
  SFChevronDown,
  SFChevronLeft,
  SFChevronLeftForwardslashChevronRight,
  SFChevronRight,
  SFClock,
  SFCommand,
  SFCpu,
  SFDocument,
  SFDocumentOnDocument,
  SFEllipsis,
  SFExclamationmarkShield,
  SFExternaldrive,
  SFFolder,
  SFFolderBadgeGearshape,
  SFFolderBadgePlus,
  SFGearshape,
  SFGlobe,
  SFHouse,
  SFInsetFilledBottomthirdRectangle,
  SFLadybug,
  SFLaptopcomputer,
  SFListBulletClipboard,
  SFMemorychip,
  SFMicrophone,
  SFMagnifyingglass,
  SFMinusMagnifyingglass,
  SFMoonStars,
  SFNumber,
  SFPaperclip,
  SFPerson,
  SFPin,
  SFPlay,
  SFPlus,
  SFPlusMagnifyingglass,
  SFPowerplug,
  SFQuestionmarkCircle,
  SFServerRack,
  SFSidebarRight,
  SFSliderHorizontal3,
  SFSparkles,
  SFSquareAndPencil,
  SFSquareGrid2x2,
  SFStar,
  SFStarFill,
  SFStopCircle,
  SFTrash,
  SFTrayFull,
  SFWandAndSparkles,
  SFXmark,
} from 'sf-symbols-lib/monochrome';

export interface IconProps extends Omit<SVGAttributes<SVGSVGElement>, 'width' | 'height'> {
  readonly size?: number;
  readonly fill?: string;
}

type SFIconComponent = ComponentType<SFIconProps>;

function symbol(Icon: SFIconComponent, displayName: string): (props: IconProps) => ReactElement {
  function Wrapped({ size = 16, className, style, ...rest }: IconProps): ReactElement {
    return (
      <Icon
        size={size}
        className={['ganymede-icon', className].filter(Boolean).join(' ') || undefined}
        style={style}
        aria-hidden={rest['aria-hidden'] ?? true}
        {...rest}
      />
    );
  }
  Wrapped.displayName = displayName;
  return Wrapped;
}

export const Archive = symbol(SFArchivebox, 'Archive');
export const AtSign = symbol(SFAt, 'AtSign');
export const ArrowLeft = symbol(SFChevronLeft, 'ArrowLeft');
export const ArrowRight = symbol(SFChevronRight, 'ArrowRight');
export const ArrowUp = symbol(SFArrowUp, 'ArrowUp');
export const Bot = symbol(SFCpu, 'Bot');
export const Bookmark = symbol(SFBookmark, 'Bookmark');
export const Boxes = symbol(SFSquareGrid2x2, 'Boxes');
export const Brain = symbol(SFBrainHeadProfile, 'Brain');
export const Bug = symbol(SFLadybug, 'Bug');
export const Check = symbol(SFCheckmark, 'Check');
export const ChevronDown = symbol(SFChevronDown, 'ChevronDown');
export const ChevronRight = symbol(SFChevronRight, 'ChevronRight');
export const CircleStop = symbol(SFStopCircle, 'CircleStop');
export const Clock3 = symbol(SFClock, 'Clock3');
export const Code2 = symbol(SFChevronLeftForwardslashChevronRight, 'Code2');
export const Command = symbol(SFCommand, 'Command');
export const Copy = symbol(SFDocumentOnDocument, 'Copy');
export const FileCode2 = symbol(SFChevronLeftForwardslashChevronRight, 'FileCode2');
export const FileDiff = symbol(SFArrowLeftArrowRight, 'FileDiff');
export const FileText = symbol(SFDocument, 'FileText');
export const Folder = symbol(SFFolder, 'Folder');
export const FolderGit2 = symbol(SFFolderBadgeGearshape, 'FolderGit2');
export const FolderOpen = symbol(SFFolder, 'FolderOpen');
export const FolderPlus = symbol(SFFolderBadgePlus, 'FolderPlus');
export const GitBranch = symbol(SFArrowTriangleheadBranch, 'GitBranch');
export const GitCommit = symbol(SFArrowUpToLine, 'GitCommit');
export const GitPullRequest = symbol(SFArrowTriangleheadPull, 'GitPullRequest');
export const Globe2 = symbol(SFGlobe, 'Globe2');
export const Hash = symbol(SFNumber, 'Hash');
export const House = symbol(SFHouse, 'House');
export const Inbox = symbol(SFTrayFull, 'Inbox');
export const Laptop = symbol(SFLaptopcomputer, 'Laptop');
export const ListTodo = symbol(SFListBulletClipboard, 'ListTodo');
export const LoaderCircle = symbol(SFArrowClockwise, 'LoaderCircle');
export const Maximize2 = symbol(SFArrowUpLeftAndArrowDownRight, 'Maximize2');
export const MemoryStick = symbol(SFMemorychip, 'MemoryStick');
export const MessageCircle = symbol(SFBubbleLeft, 'MessageCircle');
export const MessageSquare = symbol(SFSquareAndPencil, 'MessageSquare');
export const Mic = symbol(SFMicrophone, 'Mic');
export const MoonStar = symbol(SFMoonStars, 'MoonStar');
export const MoreHorizontal = symbol(SFEllipsis, 'MoreHorizontal');
export const Paperclip = symbol(SFPaperclip, 'Paperclip');
export const PanelBottom = symbol(SFInsetFilledBottomthirdRectangle, 'PanelBottom');
export const PanelRight = symbol(SFSidebarRight, 'PanelRight');
export const Play = symbol(SFPlay, 'Play');
export const Plug = symbol(SFPowerplug, 'Plug');
export const Plus = symbol(SFPlus, 'Plus');
export const Pin = symbol(SFPin, 'Pin');
export const RefreshCw = symbol(SFArrowClockwise, 'RefreshCw');
export const Search = symbol(SFMagnifyingglass, 'Search');
export const Server = symbol(SFServerRack, 'Server');
export const Settings = symbol(SFGearshape, 'Settings');
export const ShieldAlert = symbol(SFExclamationmarkShield, 'ShieldAlert');
export const ShieldCheck = symbol(SFCheckmarkShield, 'ShieldCheck');
export const ShieldQuestion = symbol(SFQuestionmarkCircle, 'ShieldQuestion');
export const SlidersHorizontal = symbol(SFSliderHorizontal3, 'SlidersHorizontal');
export const Sparkles = symbol(SFSparkles, 'Sparkles');
export const TerminalSquare = symbol(SFAppleTerminal, 'TerminalSquare');
export const Trash2 = symbol(SFTrash, 'Trash2');
export const User = symbol(SFPerson, 'User');
export const WandSparkles = symbol(SFWandAndSparkles, 'WandSparkles');
export const X = symbol(SFXmark, 'X');
export const ZoomIn = symbol(SFPlusMagnifyingglass, 'ZoomIn');
export const ZoomOut = symbol(SFMinusMagnifyingglass, 'ZoomOut');

export function Star({ size = 16, className, fill, style, ...rest }: IconProps): ReactElement {
  const Icon = fill === 'currentColor' ? SFStarFill : SFStar;
  return (
    <Icon
      size={size}
      className={['ganymede-icon', className].filter(Boolean).join(' ') || undefined}
      style={style}
      aria-hidden={rest['aria-hidden'] ?? true}
      {...rest}
    />
  );
}

// Finder / external drive affordances used in a few workspace menus.
export const ExternalDrive = symbol(SFExternaldrive, 'ExternalDrive');
