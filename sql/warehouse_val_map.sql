-- phpMyAdmin SQL Dump
-- version 5.2.2
-- https://www.phpmyadmin.net/
--
-- Servidor: 127.0.0.1:3306
-- Tiempo de generación: 02-04-2026 a las 18:26:47
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
-- Estructura de tabla para la tabla `warehouse_val_map`
--

CREATE TABLE `warehouse_val_map` (
  `id` int(11) NOT NULL,
  `val_code` varchar(20) NOT NULL,
  `warehouse_id` int(11) NOT NULL,
  `descripcion` varchar(100) DEFAULT ''
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `warehouse_val_map`
--

INSERT INTO `warehouse_val_map` (`id`, `val_code`, `warehouse_id`, `descripcion`) VALUES
(1, '40219', 5, 'Bisonte SLP'),
(2, '40226', 5, 'Exclusa SLP');

--
-- Índices para tablas volcadas
--

--
-- Indices de la tabla `warehouse_val_map`
--
ALTER TABLE `warehouse_val_map`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `val_code` (`val_code`),
  ADD KEY `fk_val_warehouse` (`warehouse_id`);

--
-- AUTO_INCREMENT de las tablas volcadas
--

--
-- AUTO_INCREMENT de la tabla `warehouse_val_map`
--
ALTER TABLE `warehouse_val_map`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- Restricciones para tablas volcadas
--

--
-- Filtros para la tabla `warehouse_val_map`
--
ALTER TABLE `warehouse_val_map`
  ADD CONSTRAINT `fk_val_warehouse` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
