-- phpMyAdmin SQL Dump
-- version 5.2.2
-- https://www.phpmyadmin.net/
--
-- Servidor: 127.0.0.1:3306
-- Tiempo de generación: 15-05-2026 a las 17:51:53
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
-- Estructura de tabla para la tabla `quotes`
--

CREATE TABLE `quotes` (
  `id` int(11) NOT NULL,
  `folio` varchar(20) NOT NULL,
  `folio_sitic` varchar(20) DEFAULT NULL,
  `no_docto` varchar(20) DEFAULT NULL,
  `cliente_id` int(11) DEFAULT NULL,
  `cliente_nombre` varchar(255) NOT NULL,
  `vendedor` varchar(255) DEFAULT NULL,
  `subtotal` decimal(14,2) NOT NULL DEFAULT 0.00,
  `iva` decimal(14,2) NOT NULL DEFAULT 0.00,
  `total` decimal(14,2) NOT NULL DEFAULT 0.00,
  `moneda` varchar(5) NOT NULL DEFAULT 'MXN',
  `tipo_cambio` decimal(10,4) NOT NULL DEFAULT 1.0000,
  `estatus` enum('borrador','enviada','aceptada','rechazada','cancelada') NOT NULL DEFAULT 'borrador',
  `notas` text DEFAULT NULL,
  `vigencia` date DEFAULT NULL,
  `fecha_consumo` date DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

--
-- Volcado de datos para la tabla `quotes`
--

INSERT INTO `quotes` (`id`, `folio`, `folio_sitic`, `no_docto`, `cliente_id`, `cliente_nombre`, `vendedor`, `subtotal`, `iva`, `total`, `moneda`, `tipo_cambio`, `estatus`, `notas`, `vigencia`, `fecha_consumo`, `created_at`, `updated_at`) VALUES
(7, 'COT-20260402-0001', '3634665', '4622', 2, 'ATB', NULL, 328986.62, 52637.86, 381624.48, 'MXN', 1.0000, 'borrador', NULL, NULL, '2026-03-17', '2026-04-02 22:18:30', '2026-04-02 22:18:30'),
(8, 'COT-20260402-0002', '3644244', '4681', 2, 'ATB', 'Juan Vendedor', 284162.94, 45466.07, 329629.01, 'MXN', 1.0000, 'borrador', NULL, NULL, '2026-03-31', '2026-04-02 22:55:33', '2026-04-02 22:55:33');

--
-- Índices para tablas volcadas
--

--
-- Indices de la tabla `quotes`
--
ALTER TABLE `quotes`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `folio` (`folio`),
  ADD KEY `cliente_id` (`cliente_id`);

--
-- AUTO_INCREMENT de las tablas volcadas
--

--
-- AUTO_INCREMENT de la tabla `quotes`
--
ALTER TABLE `quotes`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=9;

--
-- Restricciones para tablas volcadas
--

--
-- Filtros para la tabla `quotes`
--
ALTER TABLE `quotes`
  ADD CONSTRAINT `quotes_ibfk_1` FOREIGN KEY (`cliente_id`) REFERENCES `clients` (`id`) ON DELETE SET NULL;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
