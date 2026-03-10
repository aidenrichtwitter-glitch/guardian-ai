import React from "react"
import {motion} from "framer-motion"
import { changeGridCellSize } from "../../../features/grids/gridsSlice"

type GridHighlighterProps = {
  dispatch: any,
  gridIndex: number,
  label: string,
}


export const GridHighlighter = ({dispatch, gridIndex, label}: GridHighlighterProps) => {
  return (
    <motion.h5 key={`LOG_${label}`}
      whileHover={{scale: 1.4, transition: {duration: 0.2, ease: "easeOut"}}} style={{"display": "inline-block", margin: "0 0 10 0"}}
      onMouseEnter={() => 
        dispatch(changeGridCellSize({
          gridIndex: gridIndex, 
          width: 70, 
          height: 70
        }))
      }
      onMouseLeave={() => 
        dispatch(changeGridCellSize({
          gridIndex: gridIndex, 
          width: 60, 
          height: 60
        }))
      }   
    >
      {`${gridIndex + 1}. ${label}`}
    </motion.h5>
  )
}