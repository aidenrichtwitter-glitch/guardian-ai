import {render, screen} from '@testing-library/react'
// userEvent library simulates user interactions by dispatching the events that would happen if the interaction took place in a browser.
import userEvent from '@testing-library/user-event'
// add custom jest matchers from jest-dom
import '@testing-library/jest-dom'
import { ifGenericButtons, renderWithProviders } from '../../../../../../utils/testUtils'
import { QUESTIONS_ENUM } from '../../../../../../utils/questionEnum'
import { UniquePathsOneController } from '../UniquePathsOne'


describe("Unique Paths tests", () => {
  it("produces a new grid on setup", async() => {
    const {store, ...renderResult} = renderWithProviders(
      <UniquePathsOneController
        animationOn={false}
        play={() => console.log("play")}
        pause={() => console.log("pause")}
        problemNumber={QUESTIONS_ENUM.PACIFIC_ATLANTIC_WATER_FLOW}
        animationSpeed={500} 
      />
    )

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', {name: /Set Up/}));
    console.log(store.getState().grids[0]);

    await user.click(screen.getByRole('button', {name: /Step/}));
  })
})
