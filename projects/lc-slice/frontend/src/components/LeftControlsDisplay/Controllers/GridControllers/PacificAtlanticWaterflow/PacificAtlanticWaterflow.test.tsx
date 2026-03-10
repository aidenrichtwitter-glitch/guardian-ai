import {render, screen} from '@testing-library/react'
// userEvent library simulates user interactions by dispatching the events that would happen if the interaction took place in a browser.
import userEvent from '@testing-library/user-event'
// add custom jest matchers from jest-dom
import '@testing-library/jest-dom'
// the component to test
import { PacificAtlanticWaterflowController } from './PacificAtlanticWaterFlowController'


import { ifGenericButtons, renderWithProviders } from '../../../../../utils/testUtils'
import { QUESTIONS_ENUM } from '../../../../../utils/questionEnum'


describe("Pacific Atlantic Waterflow Tests", () => {
  it("renders without errors", async() => {
    const {store, ...renderResult} = renderWithProviders(
      <PacificAtlanticWaterflowController
        animationOn={false}
        play={() => console.log("play")}
        pause={() => console.log("pause")}
        problemNumber={QUESTIONS_ENUM.PACIFIC_ATLANTIC_WATER_FLOW}
        animationSpeed={500} 
      />
    )
    ifGenericButtons(screen);
  })
})

