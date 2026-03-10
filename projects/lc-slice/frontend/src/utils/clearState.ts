import { deleteAllStructs } from "../features/sharedActions";
import { changeProblemNumber } from "../features/problemInfo/problemSlice";
import { clearLog } from "../features/problemInfo/problemSlice";

export const clearState = (dispatch: any, problemNumber: number) => {
  dispatch(deleteAllStructs());
  dispatch(changeProblemNumber({problemNumber: problemNumber}));
  dispatch(clearLog());
}
