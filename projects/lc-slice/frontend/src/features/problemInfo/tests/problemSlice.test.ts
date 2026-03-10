import { deleteAllStructs } from "../../sharedActions";
import {store} from "../../store"
import { changeProblemDescription, changeProblemNumber, changeProblemTitle, clearLog, pushJSXToLog } from "../problemSlice";
import {element, elementTwo} from "./jsxEle"


beforeEach(async () => {
    //Get all structs
    await store.dispatch(deleteAllStructs());
    await store.dispatch(clearLog());
})

describe('problemSlice redux state tests', () => {


    test('if initial state is empty', () => {
        const problem = store.getState().problem;
        expect(problem.problemNumber).toEqual(0);
        expect(problem.problemTitle).toEqual("Default Title");
        expect(problem.problemDescription).toEqual("Default Description");
    })

    test("if changeProblemNumber rejects invalid number", async () => {
        let result = await store.dispatch(changeProblemNumber({problemNumber: -40}));
        const problem = store.getState().problem;
        expect(problem.problemNumber).toEqual(0);
    })

    test("if changeProblemNumber works", async () => {
        let result = await store.dispatch(changeProblemNumber({problemNumber: 3000}));
        expect(result.type).toEqual("problem/changeProblemNumber");
        const problem = store.getState().problem;
        expect(problem.problemNumber).toEqual(3000);
    })


    test("if changeProblemDescription works", async () => {
        let result = await store.dispatch(changeProblemDescription({description: "Frodo the dodo"}));
        expect(result.type).toEqual("problem/changeProblemDescription")
        const problem = store.getState().problem;
        expect(problem.problemDescription).toEqual("Frodo the dodo");
    })

    test("if changeProblemTitle works", async () => {
        let result = await store.dispatch(changeProblemTitle({title: "Tampopo"}));
        expect(result.type).toEqual("problem/changeProblemTitle");
        const problem = store.getState().problem;
        expect(problem.problemTitle).toEqual("Tampopo");
    })

    test("if pushJSX works", async () => {
        await store.dispatch(pushJSXToLog({element: element}));
        await store.dispatch(pushJSXToLog({element: elementTwo}));
        const problemInfo = store.getState().problem;
        expect(problemInfo.problemLog.length).toEqual(2);
        expect(problemInfo.problemLog[0]).toEqual(element);
        expect(problemInfo.problemLog[1]).toEqual(elementTwo);
    })
    
})
