-- phpMyAdmin SQL Dump
-- version 5.2.2
-- https://www.phpmyadmin.net/
--
-- Servidor: 127.0.0.1:3306
-- Tiempo de generación: 02-04-2026 a las 18:26:42
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
-- Estructura de tabla para la tabla `users`
--

CREATE TABLE `users` (
  `id` int(11) NOT NULL,
  `username` varchar(50) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `display_name` varchar(100) DEFAULT NULL,
  `role` enum('admin','vendedor','almacenista','gerente','user') DEFAULT 'user',
  `created_at` timestamp NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `users`
--

INSERT INTO `users` (`id`, `username`, `password_hash`, `display_name`, `role`, `created_at`) VALUES
(1, 'admin', '$2b$10$8K1p/a0dL1LXMIgoEDFrwOfMQkHjE4POy2.ggIYNcAm8rET3C0pKi', 'Administrador', 'admin', '2026-03-31 17:00:15'),
(2, 'StudioMarsNet', '$2b$10$j.NbDQfkhWdVK8iyunvZ/eY75GiLUwRbbo6lBgRPzRgxSbQkT6G3W', 'Studio Mars', 'admin', '2026-03-31 17:28:45'),
(4, 'vendedor1', '$2b$10$4XD33.UZAJhZqZWhtAH0AOe.pZfk4ijYEF13cDkeVOUuBjTP8KEVu', 'Juan Vendedor', 'vendedor', '2026-04-01 21:34:55'),
(5, 'almacenista1', '$2b$10$oh1DxoznIN.d67.yx8LUjOURPIR8JgD4VG8H1jvletqRlhiFAhuvK', 'Pedro Almacenista', 'almacenista', '2026-04-01 21:35:16'),
(6, 'gerente1', '$2b$10$VcZKF1YsQaTQ0i6Q9au7Y.vgmrQ5OoOa3/MdFdK4nQqwiDpLDn6ia', 'María Gerente', 'gerente', '2026-04-01 21:35:33'),
(7, 'usuario1', '$2b$10$3.2DltGbLz/JFNQfXO/Gl.r1dJm.gGUxyVY8fkuOlcIl1jxKn2/3i', 'Luis Usuario', 'user', '2026-04-01 21:35:47');

--
-- Índices para tablas volcadas
--

--
-- Indices de la tabla `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `username` (`username`);

--
-- AUTO_INCREMENT de las tablas volcadas
--

--
-- AUTO_INCREMENT de la tabla `users`
--
ALTER TABLE `users`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=8;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
