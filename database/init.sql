CREATE DATABASE IF NOT EXISTS marvel_card_game;
USE marvel_card_game;

DROP TABLE IF EXISTS Cards;
DROP TABLE IF EXISTS PlayerHeroStats;
DROP TABLE IF EXISTS Heroes;
DROP TABLE IF EXISTS Player;

CREATE TABLE Player (
  player_id INT AUTO_INCREMENT PRIMARY KEY,
  avatar VARCHAR(255),
  nickname VARCHAR(255) NOT NULL,
  password VARCHAR(255) NOT NULL,
  games_played INT DEFAULT 0,
  wins INT DEFAULT 0,
  loses INT DEFAULT 0,
  draws INT DEFAULT 0,
  winstreak INT DEFAULT 0,
  confirm_end_turn BOOLEAN DEFAULT 1,
  confirm_resign BOOLEAN DEFAULT 1,
  selected_hero_id INT DEFAULT NULL
);

CREATE TABLE Heroes (
  hero_id INT AUTO_INCREMENT PRIMARY KEY,
  avatar VARCHAR(255),
  alias VARCHAR(255) NOT NULL,
  special_ability TEXT
);

CREATE TABLE PlayerHeroStats (
  player_id INT,
  hero_id INT,
  games_played INT DEFAULT 0,
  wins INT DEFAULT 0,
  loses INT DEFAULT 0,
  draws INT DEFAULT 0,
  dmg_defended INT DEFAULT 0,
  dmg_dealt INT DEFAULT 0,
  cards_played INT DEFAULT 0,
  PRIMARY KEY (player_id, hero_id),
  FOREIGN KEY (player_id) REFERENCES Player(player_id) ON DELETE CASCADE,
  FOREIGN KEY (hero_id) REFERENCES Heroes(hero_id) ON DELETE CASCADE
);

CREATE TABLE Cards (
  card_id INT AUTO_INCREMENT PRIMARY KEY,
  hero_id INT,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(50) NOT NULL,
  attack INT NOT NULL,
  defense INT NOT NULL,
  cost INT NOT NULL,
  description TEXT,
  FOREIGN KEY (hero_id) REFERENCES Heroes(hero_id) ON DELETE CASCADE
);

INSERT INTO Heroes (alias, special_ability) VALUES 
('Iron Man', 'When you have at least three active Summon cards on the board, you gain an extra +1 AP each round.'), 
('Human Torch', 'When you place at least two Trade cards in the same turn, your total damage output for that round mathematically increases by +35%.'), 
('Venom', 'When you play Hybrid cards, each Trade card played in the same turn gains +2 damage, and each Summon card played in the same turn gains +2 defense per Hybrid card played.');
