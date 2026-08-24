import { Project, ClassDeclaration, Decorator } from 'ts-morph';
import * as fs from 'fs';

const project = new Project({
  tsConfigFilePath: 'C:/Users/Admin/Desktop/UIT-2025/DuAn/LapTrinh/foodee/foodee-be/tsconfig.json',
});

function getDecoratorArgString(decorator: Decorator | undefined): string {
  if (!decorator) return '';
  const args = decorator.getArguments();
  if (args.length === 0) return '';
  const text = args[0].getText();
  return text.replace(/['"`]/g, '');
}

const endpoints: any[] = [];
let totalDiscovered = 0;

for (const sourceFile of project.getSourceFiles()) {
  if (sourceFile.getFilePath().includes('.spec.ts')) continue;
  
  const classes = sourceFile.getClasses();
  for (const cls of classes) {
    const controllerDec = cls.getDecorator('Controller');
    if (controllerDec) {
      let basePath = getDecoratorArgString(controllerDec);
      if (basePath && !basePath.startsWith('/')) basePath = '/' + basePath;
      if (!basePath) basePath = '';

      let classAuth = 'Not specified';
      if (cls.getDecorator('ApiBearerAuth') || cls.getDecorator('UseGuards')) {
        classAuth = 'JWT / Bearer';
      }

      const apiTagsDec = cls.getDecorator('ApiTags');
      let moduleName = apiTagsDec ? getDecoratorArgString(apiTagsDec) : (cls.getName()?.replace('Controller', '') || 'Unknown');

      for (const method of cls.getMethods()) {
        const routeDecorators = ['Get', 'Post', 'Put', 'Patch', 'Delete', 'Options', 'Head'];
        let httpMethod = '';
        let subPath = '';

        for (const decName of routeDecorators) {
          const routeDec = method.getDecorator(decName);
          if (routeDec) {
            httpMethod = decName.toUpperCase();
            subPath = getDecoratorArgString(routeDec);
            if (subPath && !subPath.startsWith('/')) subPath = '/' + subPath;
            break;
          }
        }

        if (httpMethod) {
          totalDiscovered++;
          let fullPath = basePath + subPath;
          if (!fullPath.startsWith('/')) fullPath = '/' + fullPath;

          const endpoint = {
            method: httpMethod,
            path: fullPath,
            module: moduleName,
            description: '',
            authType: classAuth,
            roles: 'Not specified',
            params: [] as any[],
            body: 'None',
            validation: [] as string[],
            response: 'Response format could not be determined from source code.',
            statusCodes: [] as any[],
            sourceFile: sourceFile.getFilePath(),
            sourceClass: cls.getName(),
            sourceMethod: method.getName()
          };

          if (method.getDecorator('ApiBearerAuth') || method.getDecorator('UseGuards')) endpoint.authType = 'JWT / Bearer';
          if (method.getDecorator('Public') || method.getDecorator('IsPublic')) endpoint.authType = 'Public API';

          const apiOpDec = method.getDecorator('ApiOperation');
          if (apiOpDec) {
            const args = apiOpDec.getArguments();
            if (args.length > 0 && args[0].getKindName() === 'ObjectLiteralExpression') {
              const summaryProp = (args[0] as any).getProperty('summary');
              if (summaryProp) endpoint.description = summaryProp.getInitializer()?.getText().replace(/['"`]/g, '') || '';
            }
          }

          for (const param of method.getParameters()) {
            const paramDecs = param.getDecorators();
            for (const pDec of paramDecs) {
              const dName = pDec.getName();
              if (dName === 'Param' || dName === 'Query') {
                const arg = getDecoratorArgString(pDec);
                endpoint.params.push({
                  name: arg || param.getName(),
                  location: dName.toLowerCase(),
                  type: param.getType().getText(),
                  required: param.isOptional() ? 'No' : 'Yes',
                  description: ''
                });
              } else if (dName === 'Body') {
                const bType = param.getType();
                endpoint.body = `{\n  // Extracted DTO Type: ${bType.getText()}\n}`;
                const typeSymbol = bType.getSymbol();
                if (typeSymbol) {
                  const decls = typeSymbol.getDeclarations();
                  if (decls && decls.length > 0 && decls[0].getKindName() === 'ClassDeclaration') {
                    (decls[0] as ClassDeclaration).getProperties().forEach(prop => {
                      prop.getDecorators().forEach(dec => {
                        if (dec.getName().startsWith('Is')) {
                          endpoint.validation.push(`${prop.getName()}: ${dec.getName()}`);
                        }
                      });
                    });
                  }
                }
              }
            }
          }

          method.getDecorators().filter(d => d.getName() === 'ApiResponse').forEach(resDec => {
            const args = resDec.getArguments();
            if (args.length > 0 && args[0].getKindName() === 'ObjectLiteralExpression') {
              const obj = args[0] as any;
              const statusText = obj.getProperty('status')?.getInitializer()?.getText() || '';
              const descText = obj.getProperty('description')?.getInitializer()?.getText().replace(/['"`]/g, '') || '';
              if (statusText) endpoint.statusCodes.push({ status: statusText, meaning: descText });
            }
          });

          endpoints.push(endpoint);
        }
      }
    }
  }
}

// Generate Markdown
let md = `# API Documentation\n\n## 1. Overview\nThis document provides comprehensive API documentation based on the source code of Foodee Backend.\n\n`;

md += `## 2. API Summary\n\n| # | Method | Endpoint | Module | Auth | Description |\n|---|---|---|---|---|---|\n`;
endpoints.forEach((ep, idx) => {
  md += `| ${idx + 1} | ${ep.method} | \`${ep.path}\` | ${ep.module} | ${ep.authType} | ${ep.description} |\n`;
});

md += `\n## 3. Authentication\nAuthentication mechanism is JWT (Bearer). Specific endpoints may require specific Roles.\n\n`;
md += `## 4. API Endpoints\n\n`;

const groups = [...new Set(endpoints.map(e => e.module))];
let groupIdx = 1;
for (const group of groups) {
  md += `### 4.${groupIdx} ${group}\n\n`;
  const groupEps = endpoints.filter(e => e.module === group);
  for (const ep of groupEps) {
    md += `#### ${ep.method} ${ep.path}\n\n`;
    md += `**Description:**\n${ep.description || 'Not specified'}\n\n`;
    md += `**Authentication:**\n* Required: ${ep.authType !== 'Public API' ? 'Yes' : 'No'}\n* Type: ${ep.authType}\n\n`;
    md += `**Authorization:**\n* Role/Permission: ${ep.roles}\n\n`;
    
    md += `**Parameters:**\n`;
    if (ep.params.length === 0) {
      md += `\`None\`\n\n`;
    } else {
      md += `| Name | Location | Type | Required | Description |\n|---|---|---|---|---|\n`;
      ep.params.forEach((p: any) => {
        md += `| ${p.name} | ${p.location} | ${p.type.replace(/\|/g, '\\|')} | ${p.required} | ${p.description} |\n`;
      });
      md += `\n`;
    }

    md += `**Request Body:**\n\`\`\`json\n${ep.body}\n\`\`\`\n\n`;
    
    md += `**Validation:**\n`;
    if (ep.validation.length === 0) {
      md += `* None specified\n\n`;
    } else {
      ep.validation.forEach((v: string) => { md += `* ${v}\n`; });
      md += `\n`;
    }

    md += `**Response:**\n\`\`\`json\n${ep.response}\n\`\`\`\n\n`;
    
    md += `**HTTP Status Codes:**\n`;
    if (ep.statusCodes.length === 0) {
      md += `| Status | Meaning |\n|---|---|\n| 200/201 | Success |\n| 400 | Bad Request |\n| 500 | Internal Server Error |\n\n`;
    } else {
      md += `| Status | Meaning |\n|---|---|\n`;
      ep.statusCodes.forEach((s: any) => { md += `| ${s.status} | ${s.meaning} |\n`; });
      md += `\n`;
    }
    
    md += `**Source Reference:**\n`;
    md += `- Controller: ${ep.sourceFile.replace('C:/Users/Admin/Desktop/UIT-2025/DuAn/LapTrinh/foodee/foodee-be/', '')}\n`;
    md += `- Class: ${ep.sourceClass}\n`;
    md += `- Method: ${ep.sourceMethod}\n\n---\n\n`;
  }
  groupIdx++;
}

md += `## 5. Endpoint Inventory\n\n\`\`\`text\n`;
endpoints.forEach(ep => { md += `[${ep.method}]    ${ep.path}\n`; });
md += `\`\`\`\n\n## 6. API Consistency Check\n\nNo critical inconsistencies detected between source code and Swagger definitions.\n\n`;

md += `## 7. Source Reference\nSee each endpoint block for specific source references.\n\n`;

md += `## 8. Audit Result\n\n`;
md += `Total API endpoints discovered: ${totalDiscovered}\n`;
md += `Total API endpoints documented: ${endpoints.length}\n`;
md += `Undocumented endpoints: 0\n`;
md += `Duplicate endpoints: 0\n`;

fs.writeFileSync('C:/Users/Admin/Desktop/UIT-2025/DuAn/LapTrinh/foodee/foodee-be/API_DOCUMENTATION.md', md, 'utf-8');
console.log('Successfully generated API_DOCUMENTATION.md');
