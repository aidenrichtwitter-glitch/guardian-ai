import React, {useState, useRef, useEffect} from 'react';

import { useDispatch } from 'react-redux';
import Navbar from 'react-bootstrap/Navbar';
import { clearState } from '../../utils/clearState';
import FormControl from '@mui/material/FormControl';
import {InputLabel, MenuItem, Select, SelectChangeEvent, AppBar} from '@mui/material';
import {m} from "framer-motion"
import "./app_navbar.scss"

type ProblemDropdownType = {
  title: string,
  action: () => void,
  problemNumber: number,
}


const constructProblemDropdown = (
  problems: string[], 
  dispatch: any
): ProblemDropdownType[] => {
  return problems.map((problem, idx) => {
    let number = parseInt(problem.split(".")[0]);
    return {
      title: problem, 
      problemNumber: number,
      action: () => {
        clearState(dispatch, number);
      }
    }
  })
}

export type AppNavBarProps = {
  gridProblems: string[],
  graphProblems: string[],
}

const menuItemVariants = {
  hidden: {
    opacity: 0,
  },
  visible: {
    opacity: 1,
    transition: {
      type: "spring",
      delay: 1,
    }
  }
}

export const AppNavBar = ({gridProblems, graphProblems}: AppNavBarProps) => {
  const [currentGridProblem, setCurrentGridProblem] = useState<string>('');
  const [currentGraphProblem, setCurrentGraphProblem] = useState<string>('')

  const gridProblemsLabelRef = useRef<HTMLLabelElement>(null);
  const gridProblemsLabel = useRef<string>("Grid Problems");

  const dispatch = useDispatch();

  const GridProblems = constructProblemDropdown(gridProblems, dispatch);
  const GraphProblems = constructProblemDropdown(graphProblems, dispatch);

  const handleGridProblemChange = (
    event: SelectChangeEvent
  ) => {
    setCurrentGridProblem(event.target.value);
    let num = parseInt(event.target.value);
    clearState(dispatch, num);
  }

  const handleGraphProblemChange = (
    event: SelectChangeEvent
  ) => {
    setCurrentGraphProblem(event.target.value);
    let num = parseInt(event.target.value)
    clearState(dispatch, num);
  }


  useEffect(() => {
    if (gridProblemsLabelRef.current) {
      gridProblemsLabelRef.current.offsetWidth <= 50 ? gridProblemsLabel.current = "Grid" : gridProblemsLabel.current = "Grid Problems";
    }

  }, [gridProblemsLabelRef.current])



  return (
    <div id="navBarDiv">
      <AppBar id="main_navbar">
        <FormControl className="navbar_form_control" sx={{m: 1}} data-testid="expandGridProblemsTestId">
          <InputLabel ref={gridProblemsLabelRef} className="navbar_input_label-grid">Grid Problems</InputLabel>
          <Select labelId="grid_dropdown_select"
            defaultValue=''
            className="navbar_select-grid"
            value={currentGridProblem}
            label={"Grid Problems"}
            inputProps={{
              'data-testid': 'gridProblemSelectTestId'
            }}
            onChange={handleGridProblemChange}
          >
            {GridProblems.map((problem, idx) => (
              <MenuItem 
                component={m.li} 
                className="navbar_menu_item-grid" 
                key={problem.title} 
                initial="hidden"
                animate="visible"
                variants={menuItemVariants}
                value={problem.problemNumber}
              >
                  {problem.title}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl className="navbar_form_control" sx={{m: 1}}>
          <InputLabel className="navbar_input_label-graph">Graph Problems</InputLabel>
          <Select labelId="graph_dropdown_select"
            className="navbar_select-graph"
            value={currentGraphProblem}
            label={"Graph Problems"}
            onChange={handleGraphProblemChange}
          >
            {GraphProblems.map((problem, idx) => (
              <MenuItem className="navbar_menu_item-graph" key={problem.title} value={problem.problemNumber}>{problem.title}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </AppBar>
    </div>
  );
}