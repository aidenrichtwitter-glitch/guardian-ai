import { useState, useRef, useLayoutEffect } from "react"
import {ProSidebar, Menu, MenuItem} from "react-pro-sidebar"
import {Box, IconButton, Typography, useTheme} from "@mui/material"
import {Link} from "react-router-dom"
import "react-pro-sidebar/dist/css/styles.css"
import { tokens } from "./theme"
import HelpOutlineOutlinedIcon from "@mui/icons-material/HelpOutlineOutlined";
import MenuOutlinedIcon from "@mui/icons-material/MenuOutlined";
import AppsIcon from "@mui/icons-material/Apps"
import GitHubIcon from '@mui/icons-material/GitHub';
import LinkedInIcon from '@mui/icons-material/LinkedIn';
import MoreHorizIcon from "@mui/icons-material/MoreHoriz"
import ShareIcon from "@mui/icons-material/Share"
import TocIcon from "@mui/icons-material/Toc"
import LinkIcon from "@mui/icons-material/Link"
import gsap, {Elastic} from "gsap"
import { OrangeSliceSVG } from "./components/SVG/OrangeSliceSVG"
import "./app_sidebar.scss"


type ItemProps = {
  title: string,
  to: any,
  icon: any,
  selected: any,
  setSelected: any,
}


const Item = ({title, to, icon, selected, setSelected}: ItemProps) => {
  const theme = useTheme();
  const colors = tokens(theme.palette.mode);

  const ref = useRef<HTMLLIElement>(null);


  const whenMouseMove = (e: React.MouseEvent) => {
    if (!ref.current) {
      return;
    }
    const decimal = e.clientX / ref.current.offsetWidth;
    const basePercent = -100, percentRange = 200;
    const adjustablePercent = percentRange * decimal;
    const lightBluePercent = basePercent + adjustablePercent;
    ref.current.style.setProperty("--light_blue_percent", `${lightBluePercent}%`)
  }


  return (
    <Box position={"sticky"} className="sidebar_item">
      <MenuItem ref={ref}
        active={selected === title}
        style={{
          color: colors.grey[700],
        }}
        onClick={() => setSelected(title)}
        icon={icon}
        onMouseMove={whenMouseMove}
      >
        <Typography fontFamily={"S"}>{title}</Typography>
        <Link to={to}/>
      </MenuItem>
    </Box>
  )
}


type SidebarProps = {
  isSidebar: boolean
}

const AppSidebar = ({isSidebar}: SidebarProps) => {
  const theme = useTheme();
  const colors = tokens(theme.palette.mode);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const [selected, setSelected] = useState<string>("Dashboard");
  const sideBarRef = useRef<HTMLDivElement>(null);
  const emptyRef = useRef<SVGPathElement>(null);
  const timeline = useRef<gsap.core.Timeline>();

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      timeline.current = gsap.timeline()
        .from(sideBarRef.current, {translateX: -180})
        .from(".orange_slice_svg", {translateX: -20, stagger: 0.1, ease: "elastic.out(1, 0.4)", delay: -0.4})
        .from(".sidebar_item", {translateX: -200, stagger: 0.1, ease: "elastic.out(1, 0.4)", delay: -0.5})
    }, [sideBarRef])
  }, []);


  return (
    <Box display="flex"
      ref={sideBarRef}
      sx={{
        "& .pro-sidebar-inner": {
          background: `${colors.primary[400]} !important`,
        },
        "& .pro-icon-wrapper": {
          backgroundColor: "transparent !important",
        },
        "& .pro-inner-item": {
          padding: "5px 35px 5px 20px !important",
        },
        "& .pro-inner-item:hover": {
          color: "#fff !important",
        },
        "& .pro-menu-item.active": {
          color: "#6870fa !important",
        },
      }}
    
    >
      <ProSidebar collapsed={isCollapsed}>
        <Menu iconShape="square">
          {/* LOGO AND MENU ITEM */}
          <MenuItem 
            onClick={() => setIsCollapsed(!isCollapsed)}
            icon={isCollapsed ? <MenuOutlinedIcon/> : undefined}
            style={{
              margin: "10px 0 20px 0",
              color: colors.grey[100]
            }}
          >
            {!isCollapsed && (
              <Box
                display="flex"
                justifyContent="space-between"
                alignItems="center"
                ml="15px"
              >
                <Typography variant="h3" color={colors.grey[100]}>
                  LC Slice
                </Typography>
                <IconButton onClick={() => setIsCollapsed(!isCollapsed)}>
                  <MenuOutlinedIcon />
                </IconButton>
              </Box>
            )}
          </MenuItem>
          {!isCollapsed && (
            <Box mb="25px">
              <Box display="flex" justifyContent="center" alignItems="center">
                <OrangeSliceSVG opacity={1} size={120} rotate={0} position={"relative"} top={0}/>
                <path id="empty" d="undefined" ref={emptyRef}></path>
                <OrangeSliceSVG opacity={0} size={120} rotate={180} position={"absolute"} top={45} left={67} id={"orange_slice_morph"}/>
              </Box>
              <Box textAlign="center">
                <Typography
                  variant="h3"
                  color={colors.grey[900]}
                  fontWeight="bold"
                  sx={{m: "10px 0 0 0"}}>
                    Christian Helgeson
                </Typography>
                <Typography variant="h5" color={colors.greenAccent[500]}>
                    Project Creator
                </Typography>
              </Box>
            </Box>
          )}
          <Box paddingLeft={isCollapsed ? undefined : "0%"}>
            <Typography
              variant="h6"
              color={colors.grey[900]}
              sx={{ m: "15px 0 5px 20px" }}
            >
              {isCollapsed ? "Structs" : "Data Structures"}
            </Typography>
            <Box display={"grid"} className="sidebar_select_grid">
              <Item
                title="Grids"
                to="/lc_slice/grids"
                icon={<AppsIcon fontSize="large"/>}
                selected={selected}
                setSelected={setSelected}
              />
              <Item
                title="Linked Lists"
                to="/lc_slice/linked_lists"
                icon={<LinkIcon fontSize="large"/>}
                selected={selected}
                setSelected={setSelected}
              />
              <Item
                title="Graphs"
                to="/lc_slice/graphs"
                icon={<ShareIcon fontSize="large"/>}
                selected={selected}
                setSelected={setSelected}
              />
              <Item
                title="Hash Tables"
                to="/lc_slice/hash_tables"
                icon={<TocIcon fontSize="large"/>}
                selected={selected}
                setSelected={setSelected}
              />
            </Box>
            <Typography
              variant="h6"
              color={colors.grey[900]}
              sx={{ m: "15px 0 5px 20px" }}
            >
              Pages
            </Typography>
            <Box display={"grid"} className="sidebar_select_grid">
              <Item
                title="FAQ Page"
                to="/problem_container"
                icon={<HelpOutlineOutlinedIcon fontSize="large"/>}
                selected={selected}
                setSelected={setSelected}
              />
              <Item
                title="Github Page"
                to="https://github.com/cmhhelgeson/lc_slice/tree/master/frontend"
                icon={<GitHubIcon fontSize="large"/>}
                selected={selected}
                setSelected={setSelected}
              />
              <Item
                title="Linkedin Page"
                to="https://www.linkedin.com/in/christian-helgeson-02994b126/"
                icon={<LinkedInIcon fontSize="large"/>}
                selected={selected}
                setSelected={setSelected}
              />
              <Item
                to="https://letterboxd.com/chrishelgie/"
                title="Letterboxd Page"
                icon={<MoreHorizIcon fontSize="large"/>}
                selected={selected}
                setSelected={setSelected}
              />
            </Box>
          </Box>
        </Menu>
      </ProSidebar>
    </Box>
  )
}

export default AppSidebar;