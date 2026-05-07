CREATE DATABASE marvel_card_game;
USE marvel_card_game;

DROP TABLE IF EXISTS Cards;
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
  winstreak INT DEFAULT 0
);

CREATE TABLE Heroes (
  hero_id INT AUTO_INCREMENT PRIMARY KEY,
  avatar VARCHAR(255),
  alias VARCHAR(255) NOT NULL,
  special_ability ENUM('Buff', 'Debuff', 'None') DEFAULT 'None'
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
('Iron Man', 'Buff'), 
('Human Torch', 'Buff'), 
('Venom', 'Debuff');
