/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import AgentArena from './pages/AgentArena';
import Agents from './pages/Agents';
import Characters from './pages/Characters';
import Combat from './pages/Combat';
import Crafting from './pages/Crafting';
import Economy from './pages/Economy';
import Governance from './pages/Governance';
import Home from './pages/Home';
import Jobs from './pages/Jobs';
import World from './pages/World';
import WorldEvents from './pages/WorldEvents';
import Recording from './pages/Recording';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AgentArena": AgentArena,
    "Agents": Agents,
    "Characters": Characters,
    "Combat": Combat,
    "Crafting": Crafting,
    "Economy": Economy,
    "Governance": Governance,
    "Home": Home,
    "Jobs": Jobs,
    "World": World,
    "WorldEvents": WorldEvents,
    "Recording": Recording,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
    Layout: __Layout,
};