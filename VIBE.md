Write me a simple mindmap application in single html file including html, css, javascript.

You are a software architect working on a new Mind Map application working in a desktop browser or mobile webview:
- create a data model for storing nodes including its properties
- assume a mindmap has only one root node
- the data model must be easy to serialize to JSON or to XML
- user will export/import data model to a JSON based .mind file
- create JSON structure to import/export data model
- assume the JSON structure in the .mind files can change in time when software will be extended and new features added
- the structure must be versioned, this is v1
- add optional "extra" field to nodes for future proofing
- add metadata about mindmap 
- keep the tree structure flat, easier to load/save flat data, nodes are kept as a flat array in the app code
- write simple markdown output

You are an expert Angular developer working on the MindMap app:
- analyze the mindmap-glm47-v1.html mockup
- create MindMapComponent scaffold
- the component renders at full width and height of the App
- use the background style from the mockup (grey with dots)
- make sure project builds, run: ng build
- dont create node logic or buttons

You are an expert Angular developer working on the MindMap app:
- analyze the mindmap-glm47-v1.html mockup
- analyze the mindmap-gptoss-v1.html mockup
- create data model for storing nodes
- create single root node, display it in the center of the screen
- each node must be dragable
- implement node drag logic
- make sure project builds, run: ng build

You are an expert Angular developer working on the MindMap app:
- analyze existing code base in the @/app/src
- Create a help button component that shows a circular button in the bottom left corner with the '?' icon
- Display a help modal component using NgbModal in the center screen with a help lorem ipsum content when the help button component is clicked.
- Prefer to use bootstrap5 over custom UI elements
- Build the project and make sure it works, run: ng build

You are an expert Angular developer working on the MindMap app:
- analyze the mindmap-glm47-v1.html mockup
- create a flowing navbar displayed at the bottom of the view
- the navbar must have following buttons: add child node, delete selected node, download, upload, help
- dont implement button logic
- navbar must scale to full width on mobile devices, display icons only
- navbar must scale to floating positioned in the center on large screens (over 768px width), display icons with text on the right
- Prefer to use bootstrap5 over custom UI elements
- Build the project and make sure it works, run: ng build
- Remove help button, use the help button in the navbar to trigger display of the help modal

You are an expert Angular developer working on the MindMap app:
- analyze existing code base in the @/app/src
- analyze the mindmap-glm47-v1.html mockup
- analyze the mindmap-gptoss-v1.html mockup
- create the "add child node" logic, when user clicks the add node button in the navbar a new child node to the selected node should be created, if no node is selected a child to root node is created
- create the "delete selected node" logic, when user clicks the delete selected node button in the navbar the selected node is removed, user can't remove the root node
- connect nodes using bezier curve
- make sure selected node is dragable by mouse movement and touch movement (mobile devices!)
- Build the project and make sure it works, run: ng build
- Enable add child node button
- Enable delete selected node button
- The add child button is still disabled, fix it
- Fix the delete button, does not remove selected node
- The deleted node is still visible after being removed by click in the delete button
- Show the new child node at some random position around the parent node. Preffer empty space if possible / easy to calculate.

You are an expert Angular developer working on the MindMap app:
- analyze existing code base in the @/app/src
- create components directory
- move existing components to components directory
- implement simple state management for the whole app (AppState)
- move nodes data from MindMapComponent to AppState
- create services/LocalStorageService and save each change of the nodes to local storage so when the app is refreshed the last state is loaded and nodes are rendered
- Build the project and make sure it works, run: ng build

You are an expert Angular developer working on the MindMap app:
- analyze existing code base in the @/app/src
- analyze the mindmap-glm47-v1.html mockup- 
- analyze the mindmap-gptoss-v1.html mockup
- implement node title edit logic
- one click or tap selects the node
- double click or double tap allows to edit the node title
- Build the project and make sure it works, run: ng build
- Fix the node editor, the double click changes the size of the node box but changing node title with keyboard does not work, input issue?
- Node editing still does not work
- analyze @/mockups/mindmap-glm47-v1.html and implement a simmilar solution
- Double tap changes the size of the node box but selecting other node or background does not change the size of the previous node back to its right size.
- After double click or double tap the node input should focus and allow for immediate editing
- Input is not working on the mobile webview, fix it
- In the desktop browser, the double click changes the size of a node, however one extra click is required to show input and edit text, it should work with double cick immediately
- In the mobile webviw, double tap changes the size of a node, but user is unable to edit any text, on screen keyboard does not appear.

You are an expert Angular developer working on the MindMap app:
- analyze existing code base in the @/app/src
- analyze the mindmap-glm47-v1.html mockup
- implement zoom in / zoom out with mouse scroll for desktop browsers
- implement zoom in / zoom out with fingers spread
- Build the project and make sure it works, run: ng build
- Disable interface scalling on mobile devices, likely meta in index.html
- When zooming in / zooming out update mindmap-container, connections div and node layer div to match the available viewport size

You are an expert Angular developer working on the MindMap app:
- analyze existing code base in the @/app/src
- refactor event binding methods like handle* and use Angular HostListener
- Build the project and make sure it works, run: ng build

You are an expert Angular developer working on the MindMap app:
- analyze existing code base in the @/app/src
- analyze the mindmap-glm47-v1.html mockup
- implement background drag so the user can move viewport in any direction
- background drag must work for desktop browsers and for mobile webview
- Build the project and make sure it works, run: ng build
- Fix background drag for desktop browser, user can click down on background and move it in anydirection
- The background drag should work only when no node is selected

You are an expert Angular developer working on the MindMap app:
- analyze existing code base in the @/app/src
- on desktop browser, when no node is selected, user can drag the background in any direction while holding the left mouse button down and moving mouse cursor
- on desktop browser, when node is selected, user can drag the background in any direction by holding the left mouse button outside of the node and moving mouse cursor, the node position must not change
- on mobile webview, when no node is selected, user can drag the background in any direction while moving finger
- on mobile webview, when node is selected, user can drag the background in any direction by holding the finger pressed outside of the node and moving finger, the node position must not change
- on desktop browser, user can zoom in / zoom out at any moment using mouse scroll
- on mobile webview, user can zoom in / zoom out at any moment using gesture
- background drag speed must be compensated for current scale
- if a node is selected, single click outside its box is canceling the select, the node position must not be changed
- node position can only be changed by dragging
- Implement fixes 
- Build the project and make sure it works, run: ng build

You are an expert Angular developer working on the MindMap app:
- analyze existing code base in the @/app/src
- Remove the "reset view" button from the navbar and wipe out the functionality from the app state / mindmap component
- Create the "Reset Map" button (add to navbar) that resets the mindmap to initial state with a single root
- Create the "Fit view" button (add to navbar) that scales the viewport and renders the entire map centered
- Improve style of the root node, bold text font
- Build the project and make sure it works, run: ng build
- Max fit view scale is 1.0
- Fix the fit view scaling issue, when a single node is presented, its far too big, the maximum zoom level in fit view must be default scale/zoom.

You are an expert Angular developer working on the MindMap app:
- analyze existing code base in the @/app/src
- analyze the data model for the .mind file in the @/MINDFILE.md
- Create FileService in services that implement the data model import / export based on the MINDFILE.md
- Dont need the full MINDFILE.md implementation with all possible node properties
- Map existing node properties to a format in the MINDFILE.md
- The FileService must expose two methods: import and export
- The export method exports the MindMap to a .mind file (JSON format), triggers browser download of a file
- The import method imports the MindMap from a .mind file uploaded by a user
- Bind export to the Save button in the navbar
- Bind import to the Load button in the navbar
- Build the project and make sure it works, run: ng build
- Fit map to the view after import

You are an expert Angular developer working on the MindMap app:
- analyze existing code base in the @/app/src
- fix the the following bug: on mobile webview, when user clicks a node, but do not drag and clicks somewhere outside in the background the node gets moved, but instead it should not change the position and be unselected
- detect touch finger press on mobile, only then drag note, if finger was lifted and clicked outside of a node, do not move the node, just unselect it
- Build the project and make sure it works, run: ng build

You are an expert Angular developer working on the MindMap app:
- analyze existing code base in the @/app/src
- fix the the following bug: on mobile webview, when no node is selected, the user must be able to drag background in any direction
- fix background drag on mobile
- compensate drag speed for current view scale
- Build the project and make sure it works, run: ng build

You are an expert Angular developer working on the MindMap app:
- analyze existing code base in the @/app/src
- fix the the following bug: on mobile webview, when a node is selected, clicking "add node" button or "delete node" button does not work, node just gets unselected
- Build the project and make sure it works, run: ng build
- The bug fix is not completed, the issue happens quite randomly when user interacts with a selected node.

You are an expert Angular developer working on the MindMap app:
- analyze existing code base in the @/app/src
- fix the following bug: user can add and remove nodes on mobile, but the navbar buttons keep the "pressed" state after click untill user clicks outside of navbar

You are an expert Angular developer working on the MindMap app:
- analyze existing code base in the @/app/src
- fix the following bug: on mobile webview, edit title of a node does not work properly, when uses double taps on a node, input should appear and be immediately focused so the user can start editing the title, the on screen keyboard should appear, now it does not

You are an expert Angular developer working on the MindMap app:
- analyze existing code base in the @/app/src
- remove existing node edit functionality, it does not work for mobile due to a problem with input display or input focus
- create a new solution for editing nodes
- ideally: when user double clicks (desktop browser) or double taps (mobile webview) on a node, it display an input which allows to edit node title, in  case of mobile webview, the onscreen keyboard should appear
- the new solution for the node edit must work on desktop browser and mobile webview
- the new approach works on desktop and android, but there is a bug on ios
- on ios: it seems that for a fraction of the second input is rendered and immediately dissapears, so edition is not possible

You are an expert Angular developer working on the MindMap app:
- analyze existing code base in the @/app/src
- analyze createNodeElement from the @/mockups/mindmap-gptoss-v1.html, focus on how input work 
- the @/mockups/mindmap-glm47-v1.html also works on ios
- there is a bug on iOS, the input focus is broken
- on ios input.focus() does not show on screen keyboard unless there is user intent
- remove existing edit node solution
- copy the edit node solution from the mindmap-gptoss-v1.html for editing node titles, it is confirmed the mockup works on ios and android
- rewrtie the node edit completely based on the mindmap-gptoss-v1.html
- allow for multiline node titles
- Build the project and make sure it works, run: ng build

You are an expert Angular developer working on the MindMap app:
- analyze existing code base in the @/app/src
- analyze @/mockups/mindmap-gptoss-v1.html, focus on how input work 
- analyze @/mockups/mindmap-glm47-v1.html
- 1. currently there is a bug on mobile devices while editing node title, the caret sticks to the left side and letters are pushed to the right so the words are getting mirrored
- 2. when user clicks or taps on a ndoe it should be highlighted
- prefer the design from the mindmap-gptoss-v1.html
- fix the issues
- Build the project and make sure it works, run in the /app directory: ng build
- One issue remains: when user clicks inside the node, user see caret blinking and can edit text but the node is not getting selected.

@/rnd-mindmapp You are working on the MindMap app production deployment:
- Create Dockerfile and docker-compose.yml setup for this project
- Dockerfile should install dependencies and build the Angular application from the /app folder
- Docker must expose HTTP server listening at port :8080
- docker-compose should run the built docker container and map localhost:8080 to container:8080 port

You are an expert Angular developer working on the MindMap app:
- analyze existing code base in the @/app/src
- work on the tasks from the @/TODO.md, when a task is completed, mark it as done.
<todo>
0001; [x] - Improve node visibility, create a 1px thin border around the node by default
0002; [x] - The root node should have bold text with slightly bigger font for better visibility
0003; [x] - on mobile devices, when user finger is close to a node edge the app does not recognize that as an attempt to drag the node, instead the background drag happens, fix this behaviour and make it easier for user to drag a node even if the button is close but not exactly on the node area
0004; [x] -  when user clicks or taps on a node it enters the edit mode, but when user clicks outside of a node the edit mode should be turned off and node should be unselected
</todo>
- Build the project and make sure it works, run in the /app directory: ng build
- The issue with hit area is not completely solved. On desktop and ios it works well but on android it is now more difficult to catch a node edge and move the node.
- Revert the last android change, the issue is the following: on android the node drag attempt conflicts with background drag, node is often selected for a moment but then immediately unselected and background is being dragged instead of the node
(Reverted, too many changes)

You are an expert Angular developer working on the MindMap app:
- analyze existing code base in the @/app/src
- Improve node visibility, create a 2px thin border around the node by default in a more visible colour like blue
- Change selected node border color to orange
- The root node should have bold text with slightly bigger font for better visibility
- Build the project and make sure it works, run in the /app directory: ng build

You are an expert Angular developer working on the MindMap app:
- analyze existing code base in the @/app/src
- when user clicks or taps on a node it enters the edit mode, but when user clicks outside of a node the edit mode should be turned off and node should be unselected
- Build the project and make sure it works, run in the /app directory: ng build

You are an expert Angular developer working on the MindMap app:
- analyze existing code base in the @/app/src
- implement a complete undo/redo feature for map nodes
- the undo and redo must remember last 50 changes
- add Undo and Redo buttons to the navbar
- The history for undo and redo should only keep the final state of the node, for example: a node that is being moved should not be saved untill the node drag is complete.
- Build the project and make sure it works, run in the /app directory: ng build
- Undo and Redo buttons are missing in the navbar html

You are an expert Angular developer working on the MindMap app:
- analyze existing code base in the @/app/src
- Undo and Redo works, but it keeps the drag of the element, it should not save the node when being dragged
- Reset map should be reversable to the state before reset
- Build the project and make sure it works, run in the /app directory: ng build

You are an expert Angular developer working on the MindMap app:
- analyze existing code base in the @/app/src
- create a circular button in the top left cornet with burger icon
- create a banner logo with bold text "MindMapp" next to the button, to the right
- the button must trigger a dropdown context menu
- use NgbDropdown
- move he Save, Load, Help and Reset button from the Navbar to the dropdown menu
- Leave the existing bottom navbar as is, the new burger button is a separate navigation
- The top right button is a free floating button, do not create a top navigation bar
- The MindMapp logo should be a "background" next to it, must have lower z-index than mindmap nodes
- Build the project and make sure it works, run in the /app directory: ng build

You are an expert Angular developer working on the MindMap app:
- analyze existing code base in the @/app/src
- implement keyboard shortcuts for the MindMap actions
- key '+' create a new node when a node is selected
- key '-' delete the selected node
- Ctrl+Z (Undo) and Ctrl+Y (Redo) on Windows
- Cmd+Z (Undo) and Cmd+Shift+Z (Redo) on Mac
- ctrl+s / cmd+s save (download) mindmap
- ctrl+o / cmd+o load (upload) mindmap
- Build the project and make sure it works, run in the /app directory: ng build

You are an expert Angular developer working on the MindMap app:
- analyze existing code base in the @/app/src
- fix issue on android webview: when user selects a node for drag it immediately enters edit mode so dragging is almost impossible
- adding a node when edit mode is on (while trying to drag) is not possible, clicking add node button does not work on android
- The add/remove node issue, cant add or remove a node on android device even when a node is selected
- on android the node drag attempt conflicts with background drag, node is often selected for a moment but then immediately unselected and background is being dragged instead of the node
- Build the project and make sure it works, run in the /app directory: ng build

You are an expert Angular developer working on the MindMap app:
- analyze existing code base in the @/app/src
- improve the usability of the node editing, user must click or tap on a node to enable the title editing
- note, that on ios there is a issue with .focus() which does not show onscreen keyboard unless there is user intent to edit content
- Build the project and make sure it works, run in the /app directory: ng build
- Edit does not work at all now on any platform (desktop, android, ios)

You are an expert Angular developer working on the MindMap app:
- analyze existing code base in the @/app/src
- the mindmap component has a layer with a dotted background, however after draging viewport the div is positioned off the original position and the dotted background is not displayed on the new visible area, fix this and make sure the dotted background is always present in the whole visible area, dots distanse must follow current scale
- Build the project and make sure it works, run in the /app directory: ng build
- The issue remains, perhaps, remove the background from the layers inside minidmap component and apply background to the :host element of the mindmap component, adjust the dot dimensions for scale

You are an expert Angular developer working on the MindMap app:
- analyze existing code base in the @/app/src
- apply a similar CSS fix to hide the arrow down after the burger icon in the burger button
// Hide dropdown icon
.navbar .dropdown-toggle::after {
  display: none;
}
- Build the project and make sure it works, run in the /app directory: ng build

You are an expert Angular developer working on the MindMap app:
- analyze existing code base in the @/app/src
- use the Poppins font in the brand name (MindMapp) next to the burger button
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&display=swap" rel="stylesheet">
- Build the project and make sure it works, run in the /app directory: ng build
- Improve .logo-text class in burger button, make the font-size 1rem on mobile screens.

You are an expert Angular developer working on the MindMap app:
- analyze existing code base in the @/app/src
- In the burger button dropdown menu, move the help button to the last positio
- add a dropdown-divider before the help button
- Build the project and make sure it works, run in the /app directory: ng build

You are an expert Angular developer working on the MindMap app:
- analyze existing code base in the @/app/src
- Write the help content in the help modal.
- Briefly describe the idea of the Mind Map application.
- Write keyboard shortcuts.
- Mock Github link and use website url https://mindm.app
- Build project and check errors, run in the /app directory: ng build

# INPROGRESS

You are an expert Web developer with Angular knowledge working on the MindMapp mind mapping app:
- improve @/app/src/index.html
- add SEO tags based on the MindMapp help in help modal
- Home url is https://mindm.app
- Create extra seo tags for social integration with Facebook, Twitter, Linkedin, etc
- Assume the og:image will be in the ogimage.jpg file
- Create robots.txt in /app/public 
- Create sitemap.xml in /app/public
- make sure the robots.txt and sitemap.xml file is added to the angular build
- Build project and check errors, run in the /app directory: ng build

# TODO

You are an expert Angular developer working on the MindMap app:
- analyze existing code base in the @/app/src
- fix issue on android webview: when user selects a node for drag it immediately enters edit mode so dragging is almost impossible
- adding a node when edit mode is on (while trying to drag) is not possible, clicking add node button does not work on android
- Build the project and make sure it works, run in the /app directory: ng build
- The add/remove node issue is still present, cant add or remove a node on android device even when a node is selected

