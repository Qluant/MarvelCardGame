Phase 1: Planning, Design, and Setup (Investigate)

The foundation of the project. Focus on organizing the team and establishing the architecture.

1.1 Task Management & Communication

Set up a Kanban board (Trello, Jira, or Notion).

Break down the project into frontend, backend, database, and presentation tasks.

Assign roles and establish communication rules for the team.

1.2 Repository & Project Structure Initialization

Clone the provided Git repository.

Set up the directory structure (client/, server/, database/, docs/).

Agree on coding standards (Google HTML/CSS Style Guide, Node.js Best Practices).

1.3 Database Schema Design (MySQL)

Define the Players table (needs player_id, nickname, password_hash, wins, loses, winstreak).

Define the Heroes table (metadata for the leaders, e.g., Iron Man, Human Torch, Venom).

Define the Cards table with fields for card_id, hero_id, name, category, attack, defense, cost, and description.

Prepare the init.sql script and populate it with the balanced 21-card JSON dataset.

Phase 2: Backend Foundations & API (Act: Basic)

Building the core server logic and database communication.

2.1 Node.js / Express Server Setup

Initialize the server environment and configure environment variables (port, DB credentials).

Set up the MySQL database connection pool.

2.2 Authentication System

Create REST API endpoints for User Registration (/api/auth/register).

Implement password hashing (e.g., using bcrypt) before saving to the database.

Create the Login endpoint (/api/auth/login) and handle user sessions/tokens.

2.3 Card & Deck API

Create endpoints to fetch card data from the MySQL database to populate the game client (/api/cards).

Phase 3: Frontend & User Interface (Act: Basic)

Creating the visual components using React (JSX) and standard CSS.

3.1 Authentication UI

Build Login and Registration forms.

Add basic form validation and error handling (e.g., "Invalid password").

3.2 Lobby & Room System

Build the RoomList component to display active public games.

Build the CreateRoom component with toggles for Public/Private and a password input field.

Build the JoinRoom modal that prompts for a password if the selected room is private.

3.3 Battlefield Interface

Design the Board component, splitting it strictly into the Player's Zone (bottom) and Enemy's Zone (top).

Create the PlayerInfo component displaying Avatar, Nickname, Energy (Mana), and current Health (20 HP).

Develop the universal MarvelCard component that dynamically renders stats (Cost, Attack, Defense) based on props.

Implement visual cues for "Summon" (Taunt) cards (e.g., glowing borders to indicate they must be attacked first).

Phase 4: Multiplayer & Game Engine (Act: Basic)

The most complex phase: implementing real-time WebSockets and the turn-based ruleset.

4.1 WebSocket Integration (Socket.io)

Configure Socket.io on both the Node.js server and the React client.

Establish real-time connections upon successful login.

4.2 In-Memory Matchmaking (RAM)

Implement logic on the server to store active rooms in a Map or Array (do not store rooms in MySQL).

Handle create_room, join_room, and leave_room socket events.

Trigger the game_start event when two players successfully join a room.

4.3 The Game Loop & Ruleset

Initialization: Flip a virtual coin to decide who goes first. Give both players 20 HP and deal N random cards.

Turn Timer: Implement a strict 30-second timer per turn. If time runs out, automatically end the turn.

Energy/Cost System: Ensure players can only play cards if they have enough Energy.

Combat Logic (The Archetypes):

Validation: Server must check if the enemy has "Summon" cards on the board. If yes, attacks must target them.

Damage Calculation: * Trade vs. Summon: Attacker deals damage equal to its attack; Defender's HP drops. Attacker receives counter-damage equal to the Defender's attack.

Hybrid: Uses its defense as a buffer against counter-attacks.

Direct Attack: If no defenders exist, subtract attack value from the enemy Hero's HP.

Win/Loss Condition: Monitor Hero HP. When HP <= 0, trigger the game_over event, destroy the avatar, update the MySQL Players stats (wins/loses), and close the socket room.

Phase 5: Quality Assurance & Polish

Testing and refining the product.

5.1 Cross-Browser Compatibility

Test the game in Chrome, Firefox, and Safari. Ensure CSS layouts don't break.

5.2 Playtesting

Conduct internal team matches to test the balance between Human Torch (Trade), Venom (Hybrid), and Iron Man (Summon).

Identify and fix WebSocket desync issues or race conditions.

5.3 Code Review

Ensure all JavaScript code adheres to Best Practices.

Remove console logs, commented-out code, and unused files ("Garbage shall not pass").

Phase 6: Delivery & Defense (Evaluation)

Preparing for the Peer-to-Peer assessment.

6.1 Product Presentation Preparation

Create a slide deck (Google Slides, Canva) targeting a 7-10 minute presentation.

Structure the pitch: Team Intro -> The Problem/Idea -> Tech Stack Choice -> Game Mechanics & Architecture -> Difficulties Overcome.

6.2 Gameplay Trailer

Use QuickTime or OBS to record a smooth demonstration of the app.

Showcase registration, creating a private room, the combat mechanics (trading with Summon cards), and the win screen.

6.3 Rehearsal

Practice the pitch. Treat it as an investment pitch for your product. Leave time for an audience Q&A.

Phase 7: Retrospective & Sharing (Reflection & Share)

Consolidating knowledge and building professional presence.

7.1 Team Reflection Session

Meet the day after the presentation.

Discuss what went well, communication bottlenecks, and technical mistakes to avoid in the future.

7.2 Public Release (LinkedIn)

Write a comprehensive LinkedIn post summarizing the development journey.

Include snippets of the gameplay video or infographics of your database architecture.

Tag the post with #InnovationCampusKhPI and mention @Innovation Campus of NTU "KhPI".