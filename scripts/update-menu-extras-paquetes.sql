-- ============================================================
-- PAQUETES 5, 6, NIÑOS + ENMOLADAS — Loft Wings
-- Ejecutar en Supabase > SQL Editor
-- ============================================================

-- ── PAQUETES NUEVOS ──
INSERT INTO productos (nombre, descripcion, categoria, precio, costo, activo, ingredientes, grupos_opciones) VALUES
(
  'Paquete 5',
  '2 kg de Alitas + 1 kg de Boneless · Veggies 300g · Aderezo 120ml · Papas 450g · 4 sabores por separado · Papas con queso y catsup',
  'paquetes', 880, 0, true, '{}'::text[], '[]'::jsonb
),
(
  'Paquete 6',
  '2.5 kg de Alitas + 2 kg de Boneless · Veggies 300g · Aderezo 120ml · Papas 450g · 5 sabores por separado · Papas con queso y catsup',
  'paquetes', 1180, 0, true, '{}'::text[], '[]'::jsonb
),
(
  'Paquete Niños',
  'Nuggets o Boneless · Papas 180g · Jugo, Agua de Fruta o Refresco · 1 sabor · Papas con queso y catsup',
  'paquetes', 88, 0, true, '{}'::text[], '[]'::jsonb
);

-- ── NUEVA ESPECIALIDAD: ENMOLADAS ──
-- (actualiza el precio aquí si lo tienes, por ahora queda pendiente)
INSERT INTO productos (nombre, descripcion, categoria, precio, costo, activo, ingredientes, grupos_opciones) VALUES
(
  'Enmoladas',
  'Enmoladas con el tradicional Mole de Actopan · Frijoles · Cebolla · Crema · Queso',
  'comida', 0, 0, true, '{}'::text[], '[]'::jsonb
);
