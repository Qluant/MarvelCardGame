USE marvel_card_game;

-- Iron Man is ID 1
INSERT INTO Cards (hero_id, name, category, cost, attack, defense, description) VALUES
(1, 'Unibeam', 'Trade', 5, 8, 0, 'A concentrated beam from the chest reactor. Maximum damage at the cost of leaving defenses completely open.'),
(1, 'Repulsor Shield-Bash', 'Hybrid', 3, 3, 3, 'A strike combined with projecting an energy shield. Allows you to deal damage and absorb incoming attacks.'),
(1, 'Energy Barrier Strike', 'Hybrid', 4, 4, 4, 'Channels power into a dense kinetic barrier while ramming the target.'),
(1, 'Stark Tech Decoy', 'Summon', 1, 0, 1, 'A cheap holographic decoy with a physical hard-light shell to distract the enemy.'),
(1, 'Iron Legion Drone', 'Summon', 2, 1, 3, 'Summons an autonomous Iron Legion drone. It draws enemy fire and shoots back with light weaponry.'),
(1, 'Hulkbuster Auto-Sentry', 'Summon', 5, 2, 8, 'Deploys a heavy stationary Hulkbuster turret. Massive armor pool and automatic retaliation to attacks.'),
(1, 'Veronica Satellite Drop', 'Summon', 6, 3, 9, 'Calls down a piece of the Veronica orbital station. A massive, heavily armored structure that rains suppressing fire.');

-- Human Torch is ID 2
INSERT INTO Cards (hero_id, name, category, cost, attack, defense, description) VALUES
(2, 'Fireball Volley', 'Trade', 2, 4, 0, 'A rapid succession of fireballs. Cheap, effective, but offers zero protection.'),
(2, 'Searing Heatwave', 'Trade', 3, 5, 0, 'A focused blast of intense heat that melts through enemy defenses.'),
(2, 'Flame Dash', 'Trade', 4, 6, 0, 'Turns into a streak of fire, ramming the opponent at high speed.'),
(2, 'Nova Blast', 'Trade', 5, 8, 0, 'A devastating omnidirectional explosion of fire. Maximum destructive power.'),
(2, 'Wall of Fire', 'Hybrid', 3, 3, 2, 'Creates a blazing barrier that damages the enemy while slightly softening their counter-attack.'),
(2, 'Supernova Shield', 'Hybrid', 4, 4, 3, 'Wraps himself in a dense sphere of plasma, burning attackers while absorbing impact.'),
(2, 'Living Flame Elemental', 'Summon', 4, 2, 6, 'Conjures a semi-sentient construct of pure fire to stand in the way and burn anyone who touches it.');

-- Venom is ID 3
INSERT INTO Cards (hero_id, name, category, cost, attack, defense, description) VALUES
(3, 'Lethal Bite', 'Trade', 3, 5, 0, 'A deadly bite with razor-sharp teeth. Pierces through almost any armor.'),
(3, 'Symbiote Rage', 'Trade', 5, 7, 0, 'The symbiote goes out of control, turning into pure attacking mass.'),
(3, 'Biomass Absorption', 'Hybrid', 2, 2, 2, 'A quick strike that morphs the symbiote to absorb the immediate kinetic feedback.'),
(3, 'Feral Leap', 'Hybrid', 3, 3, 3, 'A heavy leaping pounce. The symbiote acts as a shock absorber during the collision.'),
(3, 'Tendril Whip', 'Hybrid', 4, 4, 4, 'Striking with thick tendrils from a mid-range, keeping the enemy at bay while dealing damage.'),
(3, 'Parasitic Counter', 'Hybrid', 5, 5, 5, 'A massive armored strike. The symbiote hardens perfectly just before impact.'),
(3, 'Symbiote Clone', 'Summon', 4, 2, 7, 'Creates a full clone from excess biomass. The clone takes heavy hits and bites back aggressively.');
