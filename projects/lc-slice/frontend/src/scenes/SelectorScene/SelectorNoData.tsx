import { Box, useMediaQuery, useTheme } from "@mui/material";
import DashHeader from "../../components/DashHeader";
import { PropsWithChildren } from "react";

type SelectorNoDataProps = {
  datatype: string,
  aToAn?: boolean
}

const SelectorNoData = ({children, datatype, aToAn = false}: PropsWithChildren & SelectorNoDataProps) => {
  return (
    <Box m="20px">
      <DashHeader title={`${datatype} Problems`} subtitle={`Select ${aToAn ? "an" : "a"} ${datatype.toLowerCase()} problem:`}/>
      <Box m="20px 0 0 0">
        {children}
      </Box>
    </Box>
  );
}

export const GridsSelectorNoData = ({children}: PropsWithChildren) => {return (<SelectorNoData datatype="Grid">{children}</SelectorNoData>);}
export const GraphsSelectorNoData = ({children}: PropsWithChildren) => {return (<SelectorNoData datatype="Graph">{children}</SelectorNoData>);}
export const ArraysSelectorNoData = ({children}: PropsWithChildren) => {return (<SelectorNoData datatype="Array" aToAn={true}>{children}</SelectorNoData>);}
export const LinkedListsSelectorNoData = ({children}: PropsWithChildren) => {return (<SelectorNoData datatype="Linked List">{children}</SelectorNoData>);}
export const HashTablesSelectorNoData = ({children}: PropsWithChildren) => {return (<SelectorNoData datatype="Hash Table">{children}</SelectorNoData>);}