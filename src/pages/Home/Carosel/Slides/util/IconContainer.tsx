import Tooltip, { tooltipClasses, TooltipProps } from '@mui/material/Tooltip';
import { styled } from '@mui/material/styles';

const StyledToolTip = styled(({ className, ...props }: TooltipProps) => (
  <Tooltip {...props} classes={{ popper: className }} />
))(() => ({
  [`& .${tooltipClasses.tooltip}`]: {
    fontSize: '1.2rem',
  },
}));

interface IconContainerProps {
	icon: string;
	tooltipText: string;
  iconStyles?: string;
}

const IconContainer = ({ icon, tooltipText, iconStyles }: IconContainerProps) => (
  <StyledToolTip title={tooltipText} placement="top" arrow>
    <img src={icon} className={iconStyles} />
  </StyledToolTip>
);

export default IconContainer;
