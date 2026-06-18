-- ============================================================
-- SEED PRODUCTOS — Loft Wings
-- Ejecutar en Supabase > SQL Editor
-- ============================================================

INSERT INTO productos (nombre, descripcion, categoria, precio, costo, activo, ingredientes, grupos_opciones)
VALUES

-- ── DESAYUNOS ────────────────────────────────────────────────
('Flautas 3pz',             'Pollo / Papa con chorizo / Carne',       'desayunos', 48,  0, true, '[]', '[]'),
('Huaraches solo',          NULL,                                      'desayunos', 48,  0, true, '[]', '[]'),
('Huaraches con Arrachera', NULL,                                      'desayunos', 76,  0, true, '[]', '[]'),
('Huaraches Pollo o Bistec',NULL,                                      'desayunos', 66,  0, true, '[]', '[]'),
('Huaraches con Huevo',     NULL,                                      'desayunos', 56,  0, true, '[]', '[]'),
('Huaraches con Chorizo',   NULL,                                      'desayunos', 56,  0, true, '[]', '[]'),
('Huaraches con Queso',     NULL,                                      'desayunos', 56,  0, true, '[]', '[]'),
('Enchiladas 3pz',          'Verdes o Rojas',                          'desayunos', 58,  0, true, '[]', '[]'),
('Enfrijoladas 3pz',        NULL,                                      'desayunos', 48,  0, true, '[]', '[]'),

-- ── COMIDA ───────────────────────────────────────────────────
('Super Hot Dog',           NULL,                                      'comida',    50,  0, true, '[]', '[]'),
('Super Hot Dog con Tocino',NULL,                                      'comida',    68,  0, true, '[]', '[]'),
('Tortas del Chavo',        NULL,                                      'comida',    22,  0, true, '[]', '[]'),
('Torta de Milanesa',       NULL,                                      'comida',    48,  0, true, '[]', '[]'),
('Torta con Pollo',         NULL,                                      'comida',    38,  0, true, '[]', '[]'),
('Torta con Bistec',        NULL,                                      'comida',    48,  0, true, '[]', '[]'),
('Torta con Arrachera',     NULL,                                      'comida',    58,  0, true, '[]', '[]'),
('Torta con Huevo',         NULL,                                      'comida',    32,  0, true, '[]', '[]'),
('Torta de Huevo y Chorizo',NULL,                                      'comida',    38,  0, true, '[]', '[]'),
('Pozole Pollo',            'Verde o Rojo',                            'comida',    98,  0, true, '[]', '[]'),
('Pozole Cerdo',            'Verde o Rojo',                            'comida',    98,  0, true, '[]', '[]'),
('Pozole Cabeza',           'Verde o Rojo',                            'comida',    98,  0, true, '[]', '[]'),
('Costillas 10pz',          'Elige la misma salsa que las alitas',     'comida',   188,  0, true, '[]', '[]'),
('Costillas 20pz',          'Elige la misma salsa que las alitas',     'comida',   318,  0, true, '[]', '[]'),
('Costillas 30pz',          'Elige la misma salsa que las alitas',     'comida',   428,  0, true, '[]', '[]'),

-- ── PAQUETES ─────────────────────────────────────────────────
('Paquete 1',
 '10 Alitas + vegies + 280g de papas + 1 refresco. Opción: cambiar alitas por boneless +$25',
 'paquetes', 265, 0, true, '[]', '[]'),

('Paquete 2',
 '20 Alitas o 500g de boneless + vegies + 430g de papas + 2 refrescos. Opción: +$50 te dan 500g de boneless',
 'paquetes', 440, 0, true, '[]', '[]'),

('Paquete 3',
 '30 Alitas o 750g de boneless + vegies + 430g de papas. Opción: +$75 te dan 750g de boneless',
 'paquetes', 560, 0, true, '[]', '[]'),

('Paquete 4',
 '40 Alitas o 1kg de boneless + 430g de papas. Opción: +$100 te dan 1kg de boneless',
 'paquetes', 740, 0, true, '[]', '[]');
