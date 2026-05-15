-- phpMyAdmin SQL Dump
-- version 5.2.2
-- https://www.phpmyadmin.net/
--
-- Servidor: 127.0.0.1:3306
-- Tiempo de generación: 15-05-2026 a las 17:52:02
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
-- Estructura de tabla para la tabla `requisition_approvals_log`
--

CREATE TABLE `requisition_approvals_log` (
  `id` int(11) NOT NULL,
  `requisition_id` int(11) NOT NULL,
  `previous_status` varchar(30) DEFAULT NULL,
  `new_status` varchar(30) NOT NULL,
  `changed_by` varchar(100) DEFAULT 'system',
  `notes` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `requisition_approvals_log`
--

INSERT INTO `requisition_approvals_log` (`id`, `requisition_id`, `previous_status`, `new_status`, `changed_by`, `notes`, `created_at`) VALUES
(1, 1, 'Pending', 'Approved', 'system', 'Cambio de estatus', '2026-05-14 21:33:07'),
(2, 1, 'Approved', 'In Transit', 'system', 'Cambio de estatus', '2026-05-14 22:27:21');

--
-- Índices para tablas volcadas
--

--
-- Indices de la tabla `requisition_approvals_log`
--
ALTER TABLE `requisition_approvals_log`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_req_approvals_req` (`requisition_id`),
  ADD KEY `idx_req_approvals_created` (`created_at`);

--
-- AUTO_INCREMENT de las tablas volcadas
--

--
-- AUTO_INCREMENT de la tabla `requisition_approvals_log`
--
ALTER TABLE `requisition_approvals_log`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- Restricciones para tablas volcadas
--

--
-- Filtros para la tabla `requisition_approvals_log`
--
ALTER TABLE `requisition_approvals_log`
  ADD CONSTRAINT `fk_req_approvals_req` FOREIGN KEY (`requisition_id`) REFERENCES `requisitions` (`id`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
