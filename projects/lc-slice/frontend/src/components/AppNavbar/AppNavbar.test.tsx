import {getByLabelText, render, cleanup, screen, fireEvent, getByRole, waitFor, within} from '@testing-library/react'
// userEvent library simulates user interactions by dispatching the events that would happen if the interaction took place in a browser.
import userEvent from '@testing-library/user-event'
// add custom jest matchers from jest-dom
import '@testing-library/jest-dom'
// the component to test
import { AppNavBar } from './AppNavbar'
import "@testing-library/jest-dom/extend-expect"

import { renderWithProviders, renderWithReduxProvider } from '../../utils/testUtils'
import { appGridProblems, appGraphProblems } from '../../utils/appProblems'

afterEach(() => {
  cleanup();
})


describe("Pacific Atlantic Waterflow Tests", () => {
  it("renders all problem dropdowns", async() => {
    const {store, ...renderResult} = renderWithProviders(
      <AppNavBar gridProblems={appGridProblems} graphProblems={appGraphProblems}/>
    );
    expect(screen.getByTestId('expandGridProblemsTestId')).toBeInTheDocument()
    expect(screen.getByTestId('gridProblemSelectTestId')).toBeInTheDocument();
    let gridsSelect = screen.getByTestId('gridProblemSelectTestId');
  })

  it("grid dropdown has correct number of elements", async() => {
    const {store, ...renderResult} = renderWithReduxProvider(
      <AppNavBar gridProblems={appGridProblems} graphProblems={appGraphProblems}/>
    );

    const dropdowns = screen.queryAllByRole('button', {expanded: false});
    const user = userEvent.setup();
    await user.click(dropdowns[0]);

    const list = screen.getByRole('listbox');
    expect(within(list).getAllByRole("option").length).toEqual(appGridProblems.length);
  })

  it('grid dropdown options are correct', async() => {
    const {store, ...renderResult} = renderWithReduxProvider(
      <AppNavBar gridProblems={appGridProblems} graphProblems={appGraphProblems}/>
    );

    const dropdowns = screen.queryAllByRole('button', {expanded: false});
    const user = userEvent.setup();
    await user.click(dropdowns[0]);
    const list = screen.getByRole('listbox');
    const selectOptions = within(list).getAllByRole("option");
    const optionsArr = selectOptions.map(item => item.textContent);
    expect(optionsArr).toEqual(appGridProblems);
  })

  it('selects grid dropdown option, changing text and redux store', async() => {
    const {store, ...renderResult} = renderWithReduxProvider(
      <AppNavBar gridProblems={appGridProblems} graphProblems={appGraphProblems}/>
    );
    let dropdowns = screen.queryAllByRole('button', {expanded: false});
    const user = userEvent.setup();
    await user.click(dropdowns[0]);
    const list = screen.getByRole('listbox');
    const selectOptions = (within(list).getAllByRole("option")) as HTMLElement[];
    expect(selectOptions).not.toBeNull();
    expect(selectOptions[0].textContent?.split(".")[0]).not.toBeUndefined();
    const optionValue = (selectOptions[0].textContent?.split(".")[0]) as string;
    const optionContent = selectOptions[0].textContent;
    console.log(optionValue);
    console.log(optionContent);
    await user.click(selectOptions[0]);
    let curNumber = store.getState().problem.problemNumber;
    expect(curNumber.toString()).toEqual(optionValue);
    dropdowns = screen.queryAllByRole('button', {expanded: false});
    expect(dropdowns[0].textContent).toEqual(optionContent); 
  })

  it("graph dropdown has correct number of elements", async() => {
    const {store, ...renderResult} = renderWithReduxProvider(
      <AppNavBar gridProblems={appGridProblems} graphProblems={appGraphProblems}/>
    );

    const dropdowns = screen.queryAllByRole('button', {expanded: false});
    const user = userEvent.setup();
    await user.click(dropdowns[1]);

    const list = screen.getByRole('listbox');
    expect(within(list).getAllByRole("option").length).toEqual(appGraphProblems.length);
  })
})
