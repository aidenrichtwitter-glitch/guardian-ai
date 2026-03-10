import React, { useEffect, useState, useRef, lazy, Suspense} from 'react';
import './app_main.css'
import { useTheme } from '@mui/material';
import { tokens } from '../../theme';
import { Controls } from '../../components/LeftControlsDisplay/Controls'
import { DataStructureDisplay } from '../../components/RightDSDisplay';

export const AppMain = () =>  {
  //# Local State Values #//
  const theme = useTheme();
  const colors = tokens(theme.palette.mode);
  const [rightWidth, setRightWidth] = useState<number>(0);

  return (
    <Suspense fallback={<div>Data Structures Display is loading</div>}>
    <div id='app_main'>
      <div id='app_main_grid'>
        <div style={{width: "100%", height: "100%", "borderRight": `4px solid ${colors.greenAccent[400]}`}}>
          <Controls />
        </div>
        <div style={{"width": "100%", "borderLeft": `4px solid ${colors.greenAccent[400]}`}}>
          <DataStructureDisplay rightWidth={rightWidth}/>
        </div>
      </div>
    </div>  
    </Suspense>  
  );
}