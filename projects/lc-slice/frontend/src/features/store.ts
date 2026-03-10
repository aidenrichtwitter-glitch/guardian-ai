import { configureStore } from "@reduxjs/toolkit";
import { totalStructsReducer} from "./totalStructs/totalStructsSlice";
import {arraysReducer} from "./arrays/arraysSlice"
import {gridsReducer} from "./grids/gridsSlice"
import { problemReducer } from "./problemInfo/problemSlice";
import { graphsReducer } from "./graphs/graphsSlice";
import { combineReducers } from "@reduxjs/toolkit";
import { linkedListReducer } from "./linkedLists/linkedListsSlice";

export const store = configureStore({
  reducer: {
    arrays: arraysReducer,
    grids: gridsReducer,
    graphs: graphsReducer,
    totalStructs: totalStructsReducer,
    problem: problemReducer,
    linkedLists: linkedListReducer,
  },
  devTools: true,
  middleware: (getDefaultMiddleware) => {
    return getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [
          'grids/changeGridCellsStatusBasedOnData', 
          'grids/changeGridCellSize',
          'problem/pushJSXToLog/'
        ],
        ignoredActionPaths: [
          'payload.element.$$typeof',
          'problem.problemLog.0.$$typeof',
          'payload.element.type',
          'payload.element.props.dispatch',
          'problem.problemLog.0.type',
          'payload.element.props.children.0.$$typeof',
          'payload.element'
        ],
        ignoredPaths: [
          'payload.element.$$typeof',
          'problem.problemLog.0.$$typeof',
          'problem.problemLog.0.type',
          'problem.problemLog.0.props.dispatch',
          'problem.problemLog'
        ]
      }
    })
  }
})

//Types the specific dispatch we expect from our store
export type AppDispatch = typeof store.dispatch;
//Why is this here?
const testReducer = combineReducers({
  arrays: arraysReducer,
  grids: gridsReducer,
  graphs: graphsReducer,
  totalStructs: totalStructsReducer,
  problem: problemReducer,
  linkedLists: linkedListReducer
})
export type AppReducer = ReturnType<typeof testReducer>