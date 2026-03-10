import { Typography, Box, useTheme } from "@mui/material";
import { tokens } from "../theme";

type DashHeaderProps = {
  title: string,
  subtitle: string,
}

const DashHeader = ({ title, subtitle }: DashHeaderProps) => {
  const theme = useTheme();
  const colors = tokens(theme.palette.mode);
  return (
    <Box mb="0px">
      <Typography
        variant="h2"
        color={colors.blueAccent[700]}
        fontWeight="bold"
        sx={{ m: "0 20px 5px 0" }}
      >
        {title}
      </Typography>
      <Typography variant="h5" color={colors.blueAccent[600]} sx={{m: "0px 1 5px 5px"}}>
        {subtitle}
      </Typography>
    </Box>
  );
};

export default DashHeader;