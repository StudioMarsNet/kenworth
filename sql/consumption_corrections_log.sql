-- phpMyAdmin SQL Dump
-- version 5.2.2
-- https://www.phpmyadmin.net/
--
-- Servidor: 127.0.0.1:3306
-- Tiempo de generación: 02-04-2026 a las 18:25:57
-- Versión del servidor: 11.8.6-MariaDB-log
-- Versión de PHP: 7.2.34

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Base de datos: `u244760700_KW`
--

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `consumption_corrections_log`
--

CREATE TABLE `consumption_corrections_log` (
  `id` int(11) NOT NULL,
  `action` enum('edit','delete') NOT NULL,
  `record_id` int(11) DEFAULT NULL,
  `records_affected` int(11) NOT NULL DEFAULT 1,
  `changed_by` varchar(100) DEFAULT 'system',
  `details` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Índices para tablas volcadas
--

--
-- Indices de la tabla `consumption_corrections_log`
--
ALTER TABLE `consumption_corrections_log`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_ccl_created_at` (`created_at`),
  ADD KEY `idx_ccl_action` (`action`);

--
-- AUTO_INCREMENT de las tablas volcadas
--

--
-- AUTO_INCREMENT de la tabla `consumption_corrections_log`
--
ALTER TABLE `consumption_corrections_log`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
