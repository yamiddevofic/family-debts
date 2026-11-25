/**
 * Reglas locales de ESLint que hacen cumplir la constitución.
 *
 * `sin-dividir-dinero` — Artículo III y DT-04: el dinero es un entero en la unidad
 * mínima, y dividirlo o multiplicarlo produce fracciones que la constitución prohíbe.
 * El único lugar autorizado a hacerlo es `packages/core/src/reparto.ts`, que es donde
 * vive el método del mayor resto (RN-04) y donde el residuo se distribuye de forma
 * determinista en vez de perderse.
 */

const OPERADORES = new Set(['/', '*', '%', '**']);
const OPERADORES_ASIGNACION = new Set(['/=', '*=', '%=', '**=']);

/** ¿Es este tipo el `Minor` marcado de `core/src/dinero.ts`? */
function esDineroMarcado(checker, tipo) {
  const tipos = tipo.isUnion() ? tipo.types : [tipo];
  return tipos.some((t) => {
    const marca = t.getProperty('__brand');
    if (!marca) return false;
    const declaracion = marca.valueDeclaration ?? marca.declarations?.[0];
    if (!declaracion) return false;
    const tipoMarca = checker.getTypeOfSymbolAtLocation(marca, declaracion);
    return tipoMarca.isStringLiteral() && tipoMarca.value === 'Minor';
  });
}

export const reglas = {
  'sin-dividir-dinero': {
    meta: {
      type: 'problem',
      docs: {
        description:
          'Prohíbe dividir o multiplicar montos `Minor` fuera del módulo de reparto (Art. III, DT-04).',
      },
      messages: {
        prohibido:
          'Artículo III: no se puede usar `{{operador}}` sobre un monto `Minor`. ' +
          'Dividir dinero solo está permitido en core/src/reparto.ts, que reparte el residuo con RN-04.',
      },
      schema: [],
    },
    create(context) {
      const servicios = context.sourceCode.parserServices;
      if (!servicios?.program || !servicios.esTreeNodeToTSNodeMap) return {};

      const archivo = context.filename.replaceAll('\\', '/');
      if (archivo.endsWith('packages/core/src/reparto.ts')) return {};

      const checker = servicios.program.getTypeChecker();

      const esDinero = (nodo) => {
        const nodoTs = servicios.esTreeNodeToTSNodeMap.get(nodo);
        if (!nodoTs) return false;
        try {
          return esDineroMarcado(checker, checker.getTypeAtLocation(nodoTs));
        } catch {
          return false;
        }
      };

      return {
        BinaryExpression(nodo) {
          if (!OPERADORES.has(nodo.operator)) return;
          if (!esDinero(nodo.left) && !esDinero(nodo.right)) return;
          context.report({ node: nodo, messageId: 'prohibido', data: { operador: nodo.operator } });
        },
        AssignmentExpression(nodo) {
          if (!OPERADORES_ASIGNACION.has(nodo.operator)) return;
          if (!esDinero(nodo.left) && !esDinero(nodo.right)) return;
          context.report({ node: nodo, messageId: 'prohibido', data: { operador: nodo.operator } });
        },
      };
    },
  },
};

export default { rules: reglas };
