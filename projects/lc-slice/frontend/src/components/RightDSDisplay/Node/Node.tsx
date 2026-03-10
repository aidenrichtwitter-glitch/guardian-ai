import React from "react";
import { useDispatch } from "react-redux";
import {changeGridCell} from "../../../features/grids/gridsSlice";
import {CellStatus} from "../../../utils/types"
import "./node.scss"
import {ForwardRefComponent, motion} from "framer-motion"
import { useAppSelector } from "../../../features/hooks";
import clsx from "clsx";


type NodeProps = {
    rowIdx: number,
    colIdx: number,
    styleWidth: number,
    styleHeight: number,
    gridIndex: number,
    isEditable: boolean
}

const onlyNumbers = (str: string) => {
    return /^-?\d*\.{0,1}\d+$/.test(str);
}

const onlyBooleans = (str: string) => {
    if (str.includes("true") || str.includes("false")) {
        return true;
    }
    return false;
}

const parseBoolean = (str: string) => {
    const trueCheck = str.includes("true");
    const falseCheck = str.includes("false");
    if (trueCheck && falseCheck) {
        return true;
    }
    if (falseCheck) {
        return false;
    }
    if (trueCheck) {
        return true;
    }

}

const parseCellData = (data: any) => {
    if (data === true || data === false) {
        if (data === true) {
            return "true";
        }
        if (data === "false") {
            return "false";
        }
    }
    return data;
}

type NodeInnerProps = {
    cellData: number, 
    cellStatus: CellStatus, 
    cellWidth: number | undefined,
    cellHeight: number | undefined,
    styleWidth: number,
    styleHeight: number,
    onEditData: (e: React.FormEvent) => void
    isEditable: boolean,
}
export const NodeInner = React.forwardRef<HTMLDivElement, NodeInnerProps>(
  (
    {
      cellData, 
      cellStatus, 
      cellWidth, 
      cellHeight, 
      styleWidth, 
      styleHeight, 
      onEditData, 
      isEditable
    }: NodeInnerProps, 
    ref
  ) => {
    const variants = {
        normal: {width: 60, height: 60},
        change: {
            width: `${cellWidth ? cellWidth : styleWidth}px`, 
            height: `${cellHeight ? cellHeight : styleHeight}px`,
            marginBottom: `${cellHeight ? -5 : 0}px`,
            marginTop: `${cellHeight ? -5 : 0}px`,
            marginLeft: `${cellWidth ? -5 : 0}px`,
            marginRight: `${cellWidth ? -5 : 0}px`,
            zIndex: cellWidth || cellHeight ? 9 : 0,
            opacity: 1
        }
    }
    return (
        <motion.div ref={ref}
            initial="normal"
            animate="change"
            variants={variants}
            className={
                cellStatus === 'START' ? "node_start" : 
                cellStatus === "END" ? "node_end" : 
                cellStatus === "EXPLORED" ? "node_explored" :
                cellStatus === "WATER" ? "node_water" :
                cellStatus === "ISLAND" ? "node_island" :
                cellStatus === "DEEP_OCEAN" ? "node_deep_ocean" :
                cellStatus === "MONKEY_ISLAND" ? "node_monkey_island" :
                cellStatus === "CURRENT" ? "node_current" :
                cellStatus === "PREV_EVALUATE" ? "node_prev_evaluate" :
                cellStatus === "BRIDGE" ? clsx("node", "bridge") : 
                "node"
            }
            contentEditable={isEditable}
            onInput={onEditData}
            suppressContentEditableWarning={true}
        >
            {cellData.toString()}
        </motion.div>
    );

})

export const Node = ({
  gridIndex, 
  rowIdx, 
  colIdx, 
  styleWidth, 
  styleHeight, 
  isEditable
}: NodeProps) => {
    //TODO: Select individual cells
    if (rowIdx < 0 || colIdx < 0) {
      console.log("Row or Column is passed in as negative on a node");
    }
    const cellData = useAppSelector(state => state.grids[gridIndex].cells[rowIdx][colIdx] ? 
      state.grids[gridIndex].cells[rowIdx][colIdx].data : 0);
    const cellStatus = useAppSelector(state => state.grids[gridIndex].cells[rowIdx][colIdx].status);

    const cellWidth: number | undefined = useAppSelector(state => state.grids[gridIndex].cells[rowIdx][colIdx].width)
    const cellHeight: number | undefined = useAppSelector(state => state.grids[gridIndex].cells[rowIdx][colIdx].height);
    const dispatch = useDispatch();

    const onEditData = (e: React.FormEvent) => {
        const value = e.currentTarget.textContent
        if (value === null) {
            return;
        }
        if (onlyNumbers(value)) {
            const num = parseInt(value);
            dispatch(changeGridCell({gridIndex: 0, row: rowIdx, col: colIdx, data: num, status: cellStatus}));
            return;
        }
        if (onlyBooleans(value)) {
            const val = parseBoolean(value);
            dispatch(changeGridCell({gridIndex: 0, row: rowIdx, col: colIdx, data: val, status: cellStatus}));
            
        }
        
    }
    return (
        <NodeInner
            cellData={cellData}
            cellStatus={cellStatus}
            cellWidth={cellWidth}
            cellHeight={cellHeight}
            styleWidth={styleWidth}
            styleHeight={styleHeight}
            onEditData={onEditData}
            isEditable={isEditable}
        />
    );

}
