import Tooltip, { tooltipClasses, TooltipProps } from '@mui/material/Tooltip';
import { styled } from '@mui/material/styles';

const StyledToolTip = styled(({ className, ...props }: TooltipProps) => (
  <Tooltip {...props} classes={{ popper: className }} />
))(() => ({
  [`& .${tooltipClasses.tooltip}`]: {
    fontSize: '1.6rem',
  },
}));

interface IconContainerProps {
	icon: string;
	tooltipText: string;
}

const IconContainer = ({ icon, tooltipText }: IconContainerProps) => (
  <StyledToolTip title={tooltipText} placement="top" arrow>
    <img src={icon} className="h-[12vmin] max-h-[8vh]" />
  </StyledToolTip>
);

export default IconContainer;
