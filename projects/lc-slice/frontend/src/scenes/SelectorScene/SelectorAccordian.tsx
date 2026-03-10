import { Box, useMediaQuery, useTheme } from "@mui/material";
import AccordionSummary from "@mui/material/AccordionSummary";
import AccordionDetails from "@mui/material/AccordionDetails";
import Typography from "@mui/material/Typography";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { tokens } from "../../theme";
import Button from "@mui/material/Button"
import { useAppDispatch } from "../../features/hooks";
import { clearState } from "../../utils/clearState";
import { useNavigate } from "react-router-dom";
import React, {Suspense, lazy} from "react"

type SelectorAccordianProps = {
  problemId: string,
  problemNumber: number,
  title: string,
  description: string
}

export const SelectorAccordian = ({
  problemId, 
  problemNumber,
  title,
  description
}: SelectorAccordianProps) => {
  const theme = useTheme();
  const colors = tokens(theme.palette.mode);
  const matches = useMediaQuery(theme.breakpoints.up("md"));
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const Accordion = lazy(() => import('@mui/material/Accordion'))

  return (
    <Suspense fallback={<div>Loading...</div>}>
    <Accordion className={"selector_accordion"} key={`grid_problem_accordian_${problemId}`} sx={{backgroundColor: colors.primary[600]}}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />} color={colors.blueAccent[400]}>
        <Typography color={colors.primary[200]} variant="h5">
          {`${problemNumber} ${title}`}
        </Typography>
      </AccordionSummary>
      <Box display="flex" flexDirection={matches ? "row" : "column"}justifyContent={"space-between"}>
        <AccordionDetails>
          <Typography>
            {description}
          </Typography>
        </AccordionDetails>
        <Button variant="contained" onClick={() => {
          clearState(dispatch, problemNumber);
          navigate("/lc_slice/problem_container");
        }}>Select</Button>
      </Box>
    </Accordion>
    </Suspense>
  )
}


