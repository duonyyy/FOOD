const path = require('node:path');

const projectRoot = process.cwd();

function toProjectPath(filePath) {
  return path.relative(projectRoot, filePath).replaceAll('\\', '/');
}

function resolveProjectImport(importPath, filePath) {
  if (importPath.startsWith('src/')) {
    return importPath;
  }

  if (!importPath.startsWith('.')) {
    return undefined;
  }

  return toProjectPath(path.resolve(path.dirname(filePath), importPath));
}

function getFeatureName(projectPath) {
  const match = /^src\/features\/([^/]+)\//.exec(projectPath);
  if (match?.[1]) {
    return match[1];
  }

  return projectPath === 'src/features/features.module.ts' ? '__composition__' : undefined;
}

const legacyEntityOwners = {
  'address.entity': 'locations',
  'analyticsOrderMetric.entity': 'analytics',
  'category.entity': 'menu',
  'checkout.entity': 'payments',
  'conversation.entity': 'communications',
  'food.entity': 'menu',
  'message.entity': 'communications',
  'notification.entity': 'communications',
  'order.entity': 'orders',
  'orderDetail.entity': 'orders',
  'pendingShipperAssignment.entity': 'delivery',
  'permission.entity': 'identity',
  'promotion.entity': 'promotions',
  'restaurant.entity': 'restaurants',
  'review.entity': 'reviews',
  'role.entity': 'identity',
  'shipperCertificateInfo.entity': 'delivery',
  'shippingDetail.entity': 'delivery',
  'systemConstaints.entity': 'system-constraints',
  'topping.entity': 'menu',
  'user.entity': 'identity',
};

function getLegacyEntityName(projectPath) {
  const match = /^src\/entities\/([^/]+\.entity)(?:\.ts)?$/.exec(projectPath);
  return match?.[1];
}

function getProviderKey(node, sourceCode) {
  if (node.type === 'Identifier') {
    return node.name;
  }

  if (node.type !== 'ObjectExpression') {
    return undefined;
  }

  const provideProperty = node.properties.find(
    (property) =>
      property.type === 'Property' &&
      property.key.type === 'Identifier' &&
      property.key.name === 'provide',
  );

  return provideProperty?.type === 'Property'
    ? sourceCode.getText(provideProperty.value)
    : undefined;
}

module.exports = {
  rules: {
    'feature-import-boundaries': {
      meta: {
        type: 'problem',
        schema: [],
        messages: {
          deepFeatureImport:
            'Cross-feature imports must target src/features/<feature>/public-api, never internals.',
          internalInfraImport:
            'Features must use a feature-owned port or public adapter contract, not src/infra internals.',
        },
      },
      create(context) {
        const sourceFeature = getFeatureName(toProjectPath(context.filename));
        if (!sourceFeature) {
          return {};
        }

        const checkImport = (node) => {
          if (!node.source || typeof node.source.value !== 'string') {
            return;
          }

          const targetPath = resolveProjectImport(node.source.value, context.filename);
          if (!targetPath) {
            return;
          }

          if (
            targetPath.startsWith('src/infra/') &&
            !targetPath.startsWith('src/infra/contracts/')
          ) {
            context.report({ node: node.source, messageId: 'internalInfraImport' });
            return;
          }

          const targetFeature = getFeatureName(targetPath);
          const isPublicApi =
            targetPath === `src/features/${targetFeature}/public-api` ||
            targetPath === `src/features/${targetFeature}/merchant-catalog.public-api`;
          if (targetFeature && targetFeature !== sourceFeature && !isPublicApi) {
            context.report({ node: node.source, messageId: 'deepFeatureImport' });
          }
        };

        return {
          ImportDeclaration: checkImport,
          ExportAllDeclaration: checkImport,
          ExportNamedDeclaration: checkImport,
        };
      },
    },
    'no-foreign-legacy-entity-import': {
      meta: {
        type: 'problem',
        schema: [],
        messages: {
          foreignLegacyEntity:
            'Feature {{sourceFeature}} cannot import legacy entity {{entity}} owned by {{ownerFeature}}. Use its public contract instead.',
        },
      },
      create(context) {
        const sourceFeature = getFeatureName(toProjectPath(context.filename));
        if (!sourceFeature || sourceFeature === '__composition__') {
          return {};
        }

        return {
          ImportDeclaration(node) {
            if (typeof node.source.value !== 'string') {
              return;
            }

            const targetPath = resolveProjectImport(node.source.value, context.filename);
            if (!targetPath) {
              return;
            }

            const entity = getLegacyEntityName(targetPath);
            const ownerFeature = entity ? legacyEntityOwners[entity] : undefined;
            if (ownerFeature && ownerFeature !== sourceFeature) {
              context.report({
                node: node.source,
                messageId: 'foreignLegacyEntity',
                data: { entity, sourceFeature, ownerFeature },
              });
            }
          },
        };
      },
    },
    'no-forward-ref': {
      meta: {
        type: 'problem',
        schema: [],
        messages: {
          forwardRef:
            'forwardRef() is forbidden. Break the dependency with a public API, port, facade, or event.',
        },
      },
      create(context) {
        return {
          CallExpression(node) {
            if (node.callee.type === 'Identifier' && node.callee.name === 'forwardRef') {
              context.report({ node, messageId: 'forwardRef' });
            }
          },
        };
      },
    },
    'no-duplicate-module-providers': {
      meta: {
        type: 'problem',
        schema: [],
        messages: {
          duplicateProvider:
            'Provider {{provider}} is declared more than once in this Nest module.',
        },
      },
      create(context) {
        const sourceCode = context.sourceCode;

        return {
          CallExpression(node) {
            if (
              node.callee.type !== 'Identifier' ||
              node.callee.name !== 'Module' ||
              node.arguments[0]?.type !== 'ObjectExpression'
            ) {
              return;
            }

            const providersProperty = node.arguments[0].properties.find(
              (property) =>
                property.type === 'Property' &&
                property.key.type === 'Identifier' &&
                property.key.name === 'providers' &&
                property.value.type === 'ArrayExpression',
            );
            if (
              providersProperty?.type !== 'Property' ||
              providersProperty.value.type !== 'ArrayExpression'
            ) {
              return;
            }

            const providers = new Set();
            for (const provider of providersProperty.value.elements) {
              if (!provider) {
                continue;
              }

              const providerKey = getProviderKey(provider, sourceCode);
              if (!providerKey) {
                continue;
              }

              if (providers.has(providerKey)) {
                context.report({
                  node: provider,
                  messageId: 'duplicateProvider',
                  data: { provider: providerKey },
                });
              }
              providers.add(providerKey);
            }
          },
        };
      },
    },
  },
};
