import { StyledToolTip } from "@/misc/StyledComponents/StyledToolTip";

import { type IconInterface } from "./Icons";

interface IconContainerProps {
  icon: IconInterface;
  iconStyles?: string;
}

export const IconContainer = ({ icon, iconStyles }: IconContainerProps) => (
  <StyledToolTip title={icon.tooltipText} placement="top" arrow>
    <img src={icon.icon} alt={icon.tooltipText} className={iconStyles} />
  </StyledToolTip>
);
