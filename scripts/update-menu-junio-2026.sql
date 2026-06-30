-- ============================================================
-- ACTUALIZACIÓN COMPLETA MENÚ — Loft Wings  (junio 2026)
-- Ejecutar en Supabase > SQL Editor
-- ============================================================

-- ── 1. DESACTIVAR PRODUCTOS ANTERIORES CON NOMBRES INCORRECTOS ──
UPDATE productos SET activo = false WHERE nombre IN (
  'Flautas 3pz','Huaraches solo','Huaraches con Arrachera',
  'Huaraches Pollo o Bistec','Huaraches con Huevo','Huaraches con Chorizo',
  'Huaraches con Queso','Enchiladas 3pz','Enfrijoladas 3pz',
  'Super Hot Dog','Super Hot Dog con Tocino','Tortas del Chavo',
  'Torta de Milanesa','Torta con Pollo','Torta con Bistec',
  'Torta con Arrachera','Torta con Huevo','Torta de Huevo y Chorizo',
  'Pozole Pollo','Pozole Cerdo','Pozole Cabeza',
  'Costillas 10pz','Costillas 20pz','Costillas 30pz'
);

-- ── 2. ACTUALIZAR PAQUETES (nuevos precios y sabores) ──
UPDATE productos SET
  precio = 280,
  descripcion = '10 Alitas o Boneless · Veggies 150g · Aderezo 60ml · Papas 280g · 1 Refresco 355ml · 1 sabor'
WHERE nombre = 'Paquete 1' AND categoria = 'paquetes';

UPDATE productos SET
  precio = 380,
  descripcion = '20 Alitas o Boneless · Veggies 150g · Aderezo 60ml · Papas 450g · 2 Refrescos 355ml · 2 sabores'
WHERE nombre = 'Paquete 2' AND categoria = 'paquetes';

UPDATE productos SET
  precio = 580,
  descripcion = '30 Alitas o Boneless · Veggies 150g · Aderezo 60ml · Papas 450g · 3 sabores'
WHERE nombre = 'Paquete 3' AND categoria = 'paquetes';

UPDATE productos SET
  precio = 780,
  descripcion = '2 kg Alitas o Boneless · Veggies 300g · Aderezo 120ml · Papas 450g · 4 sabores'
WHERE nombre = 'Paquete 4' AND categoria = 'paquetes';

-- ── 3. ENSALADAS ──
UPDATE productos SET precio = 110 WHERE nombre = 'Ensalada César' AND categoria = 'ensaladas';
UPDATE productos SET precio = 110 WHERE nombre = 'Green Salad'    AND categoria = 'ensaladas';

INSERT INTO productos (nombre, categoria, precio, costo, activo, ingredientes, grupos_opciones)
  SELECT 'Ensalada César','ensaladas',110,0,true,'{}'::text[],'[]'::jsonb
  WHERE NOT EXISTS (SELECT 1 FROM productos WHERE nombre='Ensalada César' AND activo=true);

INSERT INTO productos (nombre, categoria, precio, costo, activo, ingredientes, grupos_opciones)
  SELECT 'Green Salad','ensaladas',110,0,true,'{}'::text[],'[]'::jsonb
  WHERE NOT EXISTS (SELECT 1 FROM productos WHERE nombre='Green Salad' AND activo=true);

-- ── 4. DESAYUNOS ──
INSERT INTO productos (nombre, descripcion, categoria, precio, costo, activo, ingredientes, grupos_opciones) VALUES
('Huevos Rancheros',         NULL, 'desayunos', 78, 0, true, '{}'::text[], '[]'::jsonb),
('Huevos Divorciados',       NULL, 'desayunos', 78, 0, true, '{}'::text[], '[]'::jsonb),
('Huevos Con Tocino',        NULL, 'desayunos', 78, 0, true, '{}'::text[], '[]'::jsonb),
('Huevos Con Chorizo',       NULL, 'desayunos', 78, 0, true, '{}'::text[], '[]'::jsonb),
('Huevos Con Jamón',         NULL, 'desayunos', 78, 0, true, '{}'::text[], '[]'::jsonb),
('Hot Cakes',                NULL, 'desayunos', 58, 0, true, '{}'::text[], '[]'::jsonb),
('Hot Cakes Con Tocino',     NULL, 'desayunos', 76, 0, true, '{}'::text[], '[]'::jsonb),
('Hot Cakes Con Jamón',      NULL, 'desayunos', 76, 0, true, '{}'::text[], '[]'::jsonb),
('Loft Cake',                NULL, 'desayunos', 78, 0, true, '{}'::text[], '[]'::jsonb);

-- ── 5. COMIDAS ──
INSERT INTO productos (nombre, descripcion, categoria, precio, costo, activo, ingredientes, grupos_opciones) VALUES
-- Flautas
('Flautas Con Pollo',                              NULL, 'comida', 58,  0, true, '{}'::text[], '[]'::jsonb),
('Flautas Con Papa Con Chorizo',                   NULL, 'comida', 58,  0, true, '{}'::text[], '[]'::jsonb),
('Flautas Con Papa Con Carne',                     NULL, 'comida', 58,  0, true, '{}'::text[], '[]'::jsonb),
-- Chilaquiles
('Chilaquiles',                                    NULL, 'comida', 58,  0, true, '{}'::text[], '[]'::jsonb),
('Chilaquiles Con Pollo',                          NULL, 'comida', 86,  0, true, '{}'::text[], '[]'::jsonb),
('Chilaquiles Con Arrachera',                      NULL, 'comida', 96,  0, true, '{}'::text[], '[]'::jsonb),
('Chilaquiles Con 2 Huevos',                       NULL, 'comida', 76,  0, true, '{}'::text[], '[]'::jsonb),
-- Molletes
('Molletes',                                       NULL, 'comida', 58,  0, true, '{}'::text[], '[]'::jsonb),
('Molletes Con Chorizo',                           NULL, 'comida', 86,  0, true, '{}'::text[], '[]'::jsonb),
('Molletes Con 2 Huevos',                          NULL, 'comida', 96,  0, true, '{}'::text[], '[]'::jsonb),
('Molletes Con Queso',                             NULL, 'comida', 76,  0, true, '{}'::text[], '[]'::jsonb),
-- Huaraches
('Huaraches',                                      NULL, 'comida', 58,  0, true, '{}'::text[], '[]'::jsonb),
('Huaraches Con Pechuga De Pollo',                 NULL, 'comida', 76,  0, true, '{}'::text[], '[]'::jsonb),
('Huaraches Con Bistec',                           NULL, 'comida', 76,  0, true, '{}'::text[], '[]'::jsonb),
('Huaraches Con Arrachera',                        NULL, 'comida', 86,  0, true, '{}'::text[], '[]'::jsonb),
('Huaraches Con Huevo',                            NULL, 'comida', 66,  0, true, '{}'::text[], '[]'::jsonb),
('Huaraches Con Chorizo',                          NULL, 'comida', 66,  0, true, '{}'::text[], '[]'::jsonb),
('Huaraches Con Queso',                            NULL, 'comida', 66,  0, true, '{}'::text[], '[]'::jsonb),
-- Hot Dogs
('Super Hotdog',                                   NULL, 'comida', 58,  0, true, '{}'::text[], '[]'::jsonb),
('Super Hotdog Con Queso Cheddar Gratinado Con Tocino', NULL, 'comida', 76, 0, true, '{}'::text[], '[]'::jsonb),
-- Tortas del Chavo
('Torta Del Chavo Jamón',                          NULL, 'comida', 28,  0, true, '{}'::text[], '[]'::jsonb),
('Torta Del Chavo Queso De Puerco',                NULL, 'comida', 28,  0, true, '{}'::text[], '[]'::jsonb),
('Torta Del Chavo Huevo',                          NULL, 'comida', 28,  0, true, '{}'::text[], '[]'::jsonb),
-- Tortas
('Torta De Milanesa',                              NULL, 'comida', 68,  0, true, '{}'::text[], '[]'::jsonb),
('Torta De Pollo',                                 NULL, 'comida', 58,  0, true, '{}'::text[], '[]'::jsonb),
('Torta De Bistec',                                NULL, 'comida', 68,  0, true, '{}'::text[], '[]'::jsonb),
('Torta De Arrachera',                             NULL, 'comida', 88,  0, true, '{}'::text[], '[]'::jsonb),
('Torta De Huevo',                                 NULL, 'comida', 38,  0, true, '{}'::text[], '[]'::jsonb),
('Torta De Huevo Con Chorizo',                     NULL, 'comida', 48,  0, true, '{}'::text[], '[]'::jsonb),
-- Enchiladas / Enfrijoladas
('Enchiladas Verdes',                              NULL, 'comida', 68,  0, true, '{}'::text[], '[]'::jsonb),
('Enchiladas Rojas',                               NULL, 'comida', 68,  0, true, '{}'::text[], '[]'::jsonb),
('Enfrijoladas',                                   NULL, 'comida', 58,  0, true, '{}'::text[], '[]'::jsonb),
-- Pozoles (rojo y blanco = verde)
('Pozole De Pollo Rojo',                           NULL, 'comida', 98,  0, true, '{}'::text[], '[]'::jsonb),
('Pozole De Cerdo Rojo',                           NULL, 'comida', 98,  0, true, '{}'::text[], '[]'::jsonb),
('Pozole De Cabeza Rojo',                          NULL, 'comida', 98,  0, true, '{}'::text[], '[]'::jsonb),
('Pozole De Pollo Blanco',                         NULL, 'comida', 98,  0, true, '{}'::text[], '[]'::jsonb),
('Pozole De Cerdo Blanco',                         NULL, 'comida', 98,  0, true, '{}'::text[], '[]'::jsonb),
('Pozole De Cabeza Blanco',                        NULL, 'comida', 98,  0, true, '{}'::text[], '[]'::jsonb),
-- Costillas
('Costillas 10 pz',  'Elige la misma salsa que las alitas', 'comida', 188, 0, true, '{}'::text[], '[]'::jsonb),
('Costillas 20 pz',  'Elige la misma salsa que las alitas', 'comida', 318, 0, true, '{}'::text[], '[]'::jsonb),
('Costillas 30 pz',  'Elige la misma salsa que las alitas', 'comida', 428, 0, true, '{}'::text[], '[]'::jsonb);

-- ── 6. EXTRAS ──
INSERT INTO productos (nombre, descripcion, categoria, precio, costo, activo, ingredientes, grupos_opciones) VALUES
('Papas a la Francesa 250g', NULL, 'extras', 70,  0, true, '{}'::text[], '[]'::jsonb),
('Papas a la Francesa 430g', NULL, 'extras', 98,  0, true, '{}'::text[], '[]'::jsonb),
('Papas Gajo 250g',          NULL, 'extras', 78,  0, true, '{}'::text[], '[]'::jsonb),
('Papas Gajo 430g',          NULL, 'extras', 98,  0, true, '{}'::text[], '[]'::jsonb),
('Aderezo Extra',            NULL, 'extras', 18,  0, true, '{}'::text[], '[]'::jsonb),
('Dedo De Queso 6 pz',       NULL, 'extras', 140, 0, true, '{}'::text[], '[]'::jsonb),
('Viggies',                  NULL, 'extras', 40,  0, true, '{}'::text[], '[]'::jsonb);

-- ── 7. BEBIDAS — Jugos 250ml ──
INSERT INTO productos (nombre, descripcion, categoria, precio, costo, activo, ingredientes, grupos_opciones) VALUES
('Jugo De Naranja 250ml',   NULL, 'bebidas', 38, 0, true, '{}'::text[], '[]'::jsonb),
('Jugo De Zanahoria 250ml', NULL, 'bebidas', 38, 0, true, '{}'::text[], '[]'::jsonb),
('Jugo Verde 250ml',        NULL, 'bebidas', 38, 0, true, '{}'::text[], '[]'::jsonb),
('Jugo Del Día 250ml',      NULL, 'bebidas', 38, 0, true, '{}'::text[], '[]'::jsonb),
-- Jugos 500ml
('Jugo De Naranja 500ml',   NULL, 'bebidas', 58, 0, true, '{}'::text[], '[]'::jsonb),
('Jugo De Zanahoria 500ml', NULL, 'bebidas', 58, 0, true, '{}'::text[], '[]'::jsonb),
('Jugo Verde 500ml',        NULL, 'bebidas', 58, 0, true, '{}'::text[], '[]'::jsonb),
('Jugo Del Día 500ml',      NULL, 'bebidas', 58, 0, true, '{}'::text[], '[]'::jsonb),
-- Jugos 1L
('Jugo De Naranja 1L',      NULL, 'bebidas', 58, 0, true, '{}'::text[], '[]'::jsonb),
('Jugo De Zanahoria 1L',    NULL, 'bebidas', 58, 0, true, '{}'::text[], '[]'::jsonb),
('Jugo Verde 1L',           NULL, 'bebidas', 58, 0, true, '{}'::text[], '[]'::jsonb),
('Jugo Del Día 1L',         NULL, 'bebidas', 58, 0, true, '{}'::text[], '[]'::jsonb),
-- Licuados 500ml
('Licuado De Choco Milk 500ml', NULL, 'bebidas', 58, 0, true, '{}'::text[], '[]'::jsonb),
('Licuado De Fresa 500ml',      NULL, 'bebidas', 58, 0, true, '{}'::text[], '[]'::jsonb),
('Licuado Del Día 500ml',       NULL, 'bebidas', 58, 0, true, '{}'::text[], '[]'::jsonb),
-- Licuados 1L
('Licuado De Choco Milk 1L', NULL, 'bebidas', 98, 0, true, '{}'::text[], '[]'::jsonb),
('Licuado De Fresa 1L',      NULL, 'bebidas', 98, 0, true, '{}'::text[], '[]'::jsonb),
('Licuado Del Día 1L',       NULL, 'bebidas', 98, 0, true, '{}'::text[], '[]'::jsonb),
-- Aguas 250ml
('Agua De Jamaica 250ml',   NULL, 'bebidas', 28, 0, true, '{}'::text[], '[]'::jsonb),
('Agua De Horchata 250ml',  NULL, 'bebidas', 28, 0, true, '{}'::text[], '[]'::jsonb),
('Agua Del Día 250ml',      NULL, 'bebidas', 28, 0, true, '{}'::text[], '[]'::jsonb),
-- Aguas 500ml
('Agua De Jamaica 500ml',   NULL, 'bebidas', 48, 0, true, '{}'::text[], '[]'::jsonb),
('Agua De Horchata 500ml',  NULL, 'bebidas', 48, 0, true, '{}'::text[], '[]'::jsonb),
('Agua Del Día 500ml',      NULL, 'bebidas', 48, 0, true, '{}'::text[], '[]'::jsonb),
-- Aguas 1L
('Agua De Jamaica 1L',      NULL, 'bebidas', 88, 0, true, '{}'::text[], '[]'::jsonb),
('Agua De Horchata 1L',     NULL, 'bebidas', 88, 0, true, '{}'::text[], '[]'::jsonb),
('Agua Del Día 1L',         NULL, 'bebidas', 88, 0, true, '{}'::text[], '[]'::jsonb),
-- Café
('Café Americano Taza',      NULL, 'bebidas', 28, 0, true, '{}'::text[], '[]'::jsonb),
('Café Americano Ilimitado', NULL, 'bebidas', 38, 0, true, '{}'::text[], '[]'::jsonb),
('Café Con Leche Taza',      NULL, 'bebidas', 38, 0, true, '{}'::text[], '[]'::jsonb),
('Café Con Leche Ilimitado', NULL, 'bebidas', 68, 0, true, '{}'::text[], '[]'::jsonb),
-- Refrescos / agua embotellada
('Coca-Cola 355ml',      NULL, 'bebidas', 38, 0, true, '{}'::text[], '[]'::jsonb),
('Coca-Cola 600ml',      NULL, 'bebidas', 58, 0, true, '{}'::text[], '[]'::jsonb),
('Sidral Mundet 355ml',  NULL, 'bebidas', 38, 0, true, '{}'::text[], '[]'::jsonb),
('Mundet Rojo 355ml',    NULL, 'bebidas', 38, 0, true, '{}'::text[], '[]'::jsonb),
('Sprite 355ml',         NULL, 'bebidas', 38, 0, true, '{}'::text[], '[]'::jsonb),
('Delaware Punch 355ml', NULL, 'bebidas', 38, 0, true, '{}'::text[], '[]'::jsonb),
('Boing 500ml',          NULL, 'bebidas', 48, 0, true, '{}'::text[], '[]'::jsonb),
('Ameyali 355ml',        NULL, 'bebidas', 38, 0, true, '{}'::text[], '[]'::jsonb),
('Predator',             NULL, 'bebidas', 48, 0, true, '{}'::text[], '[]'::jsonb),
('Monster 473ml',        NULL, 'bebidas', 48, 0, true, '{}'::text[], '[]'::jsonb),
('Electrolit',           NULL, 'bebidas', 38, 0, true, '{}'::text[], '[]'::jsonb),
('Agua Mineral',         NULL, 'bebidas', 28, 0, true, '{}'::text[], '[]'::jsonb),
('Agua Natural',         NULL, 'bebidas', 18, 0, true, '{}'::text[], '[]'::jsonb),
('Sangría Preparada',    NULL, 'bebidas', 60, 0, true, '{}'::text[], '[]'::jsonb),
-- Cervezas (lata/botella)
('Heineken 0.0 355ml',       NULL, 'bebidas', 60,  0, true, '{}'::text[], '[]'::jsonb),
('Heineken 473ml',            NULL, 'bebidas', 78,  0, true, '{}'::text[], '[]'::jsonb),
('Michelob Ultra 355ml',      NULL, 'bebidas', 68,  0, true, '{}'::text[], '[]'::jsonb),
('Corona 473ml',              NULL, 'bebidas', 68,  0, true, '{}'::text[], '[]'::jsonb),
('Negra Modelo 473ml',        NULL, 'bebidas', 68,  0, true, '{}'::text[], '[]'::jsonb),
('Modelo Especial 473ml',     NULL, 'bebidas', 68,  0, true, '{}'::text[], '[]'::jsonb),
('Victoria 473ml',            NULL, 'bebidas', 68,  0, true, '{}'::text[], '[]'::jsonb),
-- Cervezas caguama / mega
('Cerveza Victoria 500ml',    NULL, 'bebidas', 68,  0, true, '{}'::text[], '[]'::jsonb),
('Cerveza Victoria 1L',       NULL, 'bebidas', 128, 0, true, '{}'::text[], '[]'::jsonb),
('Cerveza Corona 500ml',      NULL, 'bebidas', 68,  0, true, '{}'::text[], '[]'::jsonb),
('Cerveza Corona 1L',         NULL, 'bebidas', 128, 0, true, '{}'::text[], '[]'::jsonb),
('Caguama Victoria 1.2L',     NULL, 'bebidas', 148, 0, true, '{}'::text[], '[]'::jsonb),
('Caguama Corona 1.2L',       NULL, 'bebidas', 148, 0, true, '{}'::text[], '[]'::jsonb),
-- Micheladas
('Vaso Michelado',            NULL, 'bebidas', 18,  0, true, '{}'::text[], '[]'::jsonb),
('Vaso Cubano',               NULL, 'bebidas', 28,  0, true, '{}'::text[], '[]'::jsonb),
-- Cocteles 255ml
('Mojito 255ml',                    NULL, 'bebidas', 78,  0, true, '{}'::text[], '[]'::jsonb),
('Paloma 255ml',                    NULL, 'bebidas', 78,  0, true, '{}'::text[], '[]'::jsonb),
('Cuba Con Ron Bacardí 255ml',      NULL, 'bebidas', 78,  0, true, '{}'::text[], '[]'::jsonb),
('Cuba Con Ron Appleton 255ml',     NULL, 'bebidas', 78,  0, true, '{}'::text[], '[]'::jsonb),
('Torres 255ml',                    NULL, 'bebidas', 78,  0, true, '{}'::text[], '[]'::jsonb),
('Absolut 255ml',                   NULL, 'bebidas', 78,  0, true, '{}'::text[], '[]'::jsonb),
('Tequila Tradicional 255ml',       NULL, 'bebidas', 88,  0, true, '{}'::text[], '[]'::jsonb),
('Mezcal 400 Conejos 255ml',        NULL, 'bebidas', 78,  0, true, '{}'::text[], '[]'::jsonb),
('Azulito 255ml',                   NULL, 'bebidas', 78,  0, true, '{}'::text[], '[]'::jsonb),
('Hulk 255ml',                      NULL, 'bebidas', 78,  0, true, '{}'::text[], '[]'::jsonb),
('Pantera Rosa 255ml',              NULL, 'bebidas', 78,  0, true, '{}'::text[], '[]'::jsonb),
('Whisky Chivas 255ml',             NULL, 'bebidas', 98,  0, true, '{}'::text[], '[]'::jsonb),
('Whisky Buchanan''s 255ml',        NULL, 'bebidas', 108, 0, true, '{}'::text[], '[]'::jsonb),
-- Cocteles 500ml
('Mojito 500ml',                    NULL, 'bebidas', 108, 0, true, '{}'::text[], '[]'::jsonb),
('Paloma 500ml',                    NULL, 'bebidas', 108, 0, true, '{}'::text[], '[]'::jsonb),
('Cuba Con Ron Bacardí 500ml',      NULL, 'bebidas', 108, 0, true, '{}'::text[], '[]'::jsonb),
('Cuba Con Ron Appleton 500ml',     NULL, 'bebidas', 108, 0, true, '{}'::text[], '[]'::jsonb),
('Torres 500ml',                    NULL, 'bebidas', 108, 0, true, '{}'::text[], '[]'::jsonb),
('Absolut 500ml',                   NULL, 'bebidas', 108, 0, true, '{}'::text[], '[]'::jsonb),
('Tequila Tradicional 500ml',       NULL, 'bebidas', 118, 0, true, '{}'::text[], '[]'::jsonb),
('Mezcal 400 Conejos 500ml',        NULL, 'bebidas', 108, 0, true, '{}'::text[], '[]'::jsonb),
('Azulito 500ml',                   NULL, 'bebidas', 108, 0, true, '{}'::text[], '[]'::jsonb),
('Hulk 500ml',                      NULL, 'bebidas', 108, 0, true, '{}'::text[], '[]'::jsonb),
('Pantera Rosa 500ml',              NULL, 'bebidas', 108, 0, true, '{}'::text[], '[]'::jsonb),
('Whisky Chivas 500ml',             NULL, 'bebidas', 138, 0, true, '{}'::text[], '[]'::jsonb),
('Whisky Buchanan''s 500ml',        NULL, 'bebidas', 148, 0, true, '{}'::text[], '[]'::jsonb),
-- Cocteles 1L
('Mojito 1L',                       NULL, 'bebidas', 180, 0, true, '{}'::text[], '[]'::jsonb),
('Paloma 1L',                       NULL, 'bebidas', 180, 0, true, '{}'::text[], '[]'::jsonb),
('Cuba Con Ron Bacardí 1L',         NULL, 'bebidas', 180, 0, true, '{}'::text[], '[]'::jsonb),
('Cuba Con Ron Appleton 1L',        NULL, 'bebidas', 180, 0, true, '{}'::text[], '[]'::jsonb),
('Torres 1L',                       NULL, 'bebidas', 180, 0, true, '{}'::text[], '[]'::jsonb),
('Absolut 1L',                      NULL, 'bebidas', 180, 0, true, '{}'::text[], '[]'::jsonb),
('Tequila Tradicional 1L',          NULL, 'bebidas', 188, 0, true, '{}'::text[], '[]'::jsonb),
('Mezcal 400 Conejos 1L',           NULL, 'bebidas', 180, 0, true, '{}'::text[], '[]'::jsonb),
('Azulito 1L',                      NULL, 'bebidas', 180, 0, true, '{}'::text[], '[]'::jsonb),
('Hulk 1L',                         NULL, 'bebidas', 180, 0, true, '{}'::text[], '[]'::jsonb),
('Pantera Rosa 1L',                 NULL, 'bebidas', 180, 0, true, '{}'::text[], '[]'::jsonb),
('Whisky Chivas 1L',                NULL, 'bebidas', 238, 0, true, '{}'::text[], '[]'::jsonb),
('Whisky Buchanan''s 1L',           NULL, 'bebidas', 248, 0, true, '{}'::text[], '[]'::jsonb);
