import { useState, Suspense, lazy} from 'react';
import { CssBaseline, ThemeProvider } from '@mui/material'
import {AppMain} from './components/AppMain';
import { Route, Routes} from 'react-router-dom';
import { ColorModeContext, useMode} from './theme';
import AppSidebar from './AppSidebar';
import { GridsSelectorScene, GraphsSelectorScene, HashTablesSelectorsScene, LinkedListsSelectorScene } from './scenes/SelectorScene';
import { WeclomeScene } from './scenes/WelcomeScene';



function App() {
  const {theme, colorMode} = useMode();
  const [isSidebar, setIsSidebar] = useState<boolean>(true);

  return (
    <ColorModeContext.Provider value={colorMode}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <div className="App">
          <AppSidebar isSidebar={isSidebar}/>
          <main className="content" style={{"overflowY": "auto"}}>
            <Routes>
              <Route path="/lc_slice/problem_container" element={<AppMain />}></Route>
              <Route path="/lc_slice" element={<WeclomeScene/>}></Route>
              <Route path="/lc_slice/grids" element={<GridsSelectorScene datatype='GRID'/>}/>
              <Route path="/lc_slice/graphs" element={<GraphsSelectorScene datatype='GRAPH'/>}/>
              <Route path="/lc_slice/linked_lists" element={<LinkedListsSelectorScene datatype='LINKED_LIST'/>}/>
              <Route path="/lc_slice/hash_tables" element={<HashTablesSelectorsScene/>}/>
            </Routes>    
          </main>
        </div>
      </ThemeProvider>
    </ColorModeContext.Provider>
  );
}

export default App;
