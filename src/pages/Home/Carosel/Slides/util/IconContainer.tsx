import Tooltip, { tooltipClasses, TooltipProps } from '@mui/material/Tooltip';
import { styled } from '@mui/material/styles';
import { IconInterface } from './Icons';

const StyledToolTip = styled(({ className, ...props }: TooltipProps) => (
  <Tooltip {...props} classes={{ popper: className }} />
))(() => ({
  [`& .${tooltipClasses.tooltip}`]: {
    fontSize: '1.2rem',
  },
}));

interface IconContainerProps {
	icon: IconInterface;
  iconStyles?: string;
}

const IconContainer = ({ icon, iconStyles }: IconContainerProps) => (
  <StyledToolTip title={icon.tooltipText} placement="top" arrow>
    <img src={icon.icon} alt={icon.tooltipText} className={iconStyles} />
  </StyledToolTip>
);

export default IconContainer;
