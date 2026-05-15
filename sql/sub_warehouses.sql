-- phpMyAdmin SQL Dump
-- version 5.2.2
-- https://www.phpmyadmin.net/
--
-- Servidor: 127.0.0.1:3306
-- Tiempo de generación: 02-04-2026 a las 18:26:33
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
-- Estructura de tabla para la tabla `sub_warehouses`
--

CREATE TABLE `sub_warehouses` (
  `id` int(11) NOT NULL,
  `nombre` varchar(100) NOT NULL,
  `parent_warehouse_id` int(11) DEFAULT NULL COMMENT 'Almacén padre (opcional)',
  `ubicacion` varchar(200) DEFAULT NULL,
  `descripcion` text DEFAULT NULL,
  `activo` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `sub_warehouses`
--

INSERT INTO `sub_warehouses` (`id`, `nombre`, `parent_warehouse_id`, `ubicacion`, `descripcion`, `activo`, `created_at`) VALUES
(1, 'Bisonte San Luis Potosí', NULL, 'Eje 128 139, Industrial San Luis, 78395 San Luis Potosí, S.L.P.', NULL, 0, '2026-04-02 14:20:57'),
(2, 'Exclusa Bisonte SLP', 5, 'Eje 128 139, Industrial San Luis, 78395 San Luis Potosí, S.L.P.', NULL, 1, '2026-04-02 14:21:40'),
(3, 'Bisonte San Luis Potosí', 5, 'Eje 128 139, Industrial San Luis, 78395 San Luis Potosí, S.L.P.', NULL, 1, '2026-04-02 17:52:20');

--
-- Índices para tablas volcadas
--

--
-- Indices de la tabla `sub_warehouses`
--
ALTER TABLE `sub_warehouses`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_sub_wh_parent` (`parent_warehouse_id`);

--
-- AUTO_INCREMENT de las tablas volcadas
--

--
-- AUTO_INCREMENT de la tabla `sub_warehouses`
--
ALTER TABLE `sub_warehouses`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- Restricciones para tablas volcadas
--

--
-- Filtros para la tabla `sub_warehouses`
--
ALTER TABLE `sub_warehouses`
  ADD CONSTRAINT `fk_sub_wh_parent` FOREIGN KEY (`parent_warehouse_id`) REFERENCES `warehouses` (`id`) ON DELETE SET NULL;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
