-- phpMyAdmin SQL Dump
-- version 5.2.2
-- https://www.phpmyadmin.net/
--
-- Servidor: 127.0.0.1:3306
-- Tiempo de generación: 02-04-2026 a las 18:26:26
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
-- Estructura de tabla para la tabla `requisitions`
--

CREATE TABLE `requisitions` (
  `id` int(11) NOT NULL,
  `request_id` varchar(20) NOT NULL,
  `type` enum('Requisition','Transfer') NOT NULL,
  `item_id` int(11) NOT NULL,
  `quantity` int(11) NOT NULL,
  `from_warehouse_id` int(11) DEFAULT NULL,
  `to_warehouse_id` int(11) DEFAULT NULL,
  `to_destination` varchar(255) DEFAULT NULL,
  `status` enum('Pending','Approved','In Transit','Completed','Closed','Rejected') DEFAULT 'Pending',
  `notes` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `from_sub_warehouse_id` int(11) DEFAULT NULL,
  `to_sub_warehouse_id` int(11) DEFAULT NULL,
  `observaciones` text DEFAULT NULL,
  `folio_sitic` varchar(50) DEFAULT NULL COMMENT 'Número de transferencia generado en SITIC (seguimiento oficial)'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Índices para tablas volcadas
--

--
-- Indices de la tabla `requisitions`
--
ALTER TABLE `requisitions`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `request_id` (`request_id`),
  ADD KEY `fk_requisition_item` (`item_id`),
  ADD KEY `fk_requisition_from_wh` (`from_warehouse_id`),
  ADD KEY `fk_requisition_to_wh` (`to_warehouse_id`),
  ADD KEY `idx_requisitions_status` (`status`),
  ADD KEY `idx_requisitions_type` (`type`),
  ADD KEY `fk_req_from_sub` (`from_sub_warehouse_id`),
  ADD KEY `fk_req_to_sub` (`to_sub_warehouse_id`),
  ADD KEY `idx_requisitions_folio_sitic` (`folio_sitic`);

--
-- AUTO_INCREMENT de las tablas volcadas
--

--
-- AUTO_INCREMENT de la tabla `requisitions`
--
ALTER TABLE `requisitions`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- Restricciones para tablas volcadas
--

--
-- Filtros para la tabla `requisitions`
--
ALTER TABLE `requisitions`
  ADD CONSTRAINT `fk_req_from_sub` FOREIGN KEY (`from_sub_warehouse_id`) REFERENCES `sub_warehouses` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_req_to_sub` FOREIGN KEY (`to_sub_warehouse_id`) REFERENCES `sub_warehouses` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_requisition_from_wh` FOREIGN KEY (`from_warehouse_id`) REFERENCES `warehouses` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_requisition_item` FOREIGN KEY (`item_id`) REFERENCES `inventory_items` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_requisition_to_wh` FOREIGN KEY (`to_warehouse_id`) REFERENCES `warehouses` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
