import type { ComponentType } from "react";
import { styled } from "@mui/material/styles";
import Tooltip, {
  tooltipClasses,
  type TooltipProps,
} from "@mui/material/Tooltip";

const StyledToolTip: ComponentType<TooltipProps> = styled(
  ({ className, ...props }: TooltipProps) => (
    <Tooltip {...props} classes={{ popper: className }} />
  ),
)(() => ({
  [`& .${tooltipClasses.tooltip}`]: {
    fontSize: "1.2rem",
  },
}));

export default StyledToolTip;
