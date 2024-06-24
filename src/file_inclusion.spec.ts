import { processFileInclusionsEntryPoint } from './parse';
import * as fs from 'fs';
import * as path from 'path';

// tests are 
// 1. File with nested files with footnotes
// 2. Inclusion cycle
// 3. An attempt to trick the inclusion cycle code and falsely trigger the error. (Having a file included more than once where it isn't a cycle)
// 4. Ensure that alt text works for an included document


describe('processContent', () => {
  it('should process file inclusions and footnotes correctly', () => {
    const filePath = path.resolve(__dirname, '../test_files/inclusions_with_footnotes/doc_inclusion.dj');
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const visited = new Set<string>();
    const stack = new Set<string>();
    const footnotes = new Map<string, string>();

    const result = processFileInclusionsEntryPoint(filePath, fileContent, visited, stack, footnotes);
    // this is the output that results in the correct render for HTML and Pandoc as has been verified
    const expectedOutput = `This is a test sentence with a footnote.[^1] Another footnote here.[^2]

[^2]: This is the second footnote.


[^1]: This is the first footnote.

Here is some text with a footnote reference.[^a] And another one here.[^b]


[^b]: Footnote B content.

Example text with footnotes.[^x] More text with another footnote.[^y]


[^y]: Footnote Y explanation.


[^1]: This is the first footnote.
[^a]: Footnote A content.
[^x]: Footnote X explanation.

[^1]: This is the first footnote.
[^a]: Footnote A content.
[^x]: Footnote X explanation.

Sample text including a footnote.[^alpha] Additional footnote here.[^beta]


[^beta]: Explanation for footnote beta.


[^1]: This is the first footnote.
[^a]: Footnote A content.
[^x]: Footnote X explanation.
[^alpha]: Explanation for footnote alpha.

Testing footnotes in Djot.[^one] Another footnote example.[^two]


[^two]: Details for footnote two.


[^1]: This is the first footnote.
[^a]: Footnote A content.
[^x]: Footnote X explanation.
[^alpha]: Explanation for footnote alpha.
[^one]: Details for footnote one.

[^1]: This is the first footnote.
[^a]: Footnote A content.
[^x]: Footnote X explanation.
[^alpha]: Explanation for footnote alpha.
[^one]: Details for footnote one.`;

    expect(result).toEqual(expectedOutput);
  });
});
describe('processContent', () => {
    it('should throw an error for cyclic inclusion', () => {
      const filePath = path.resolve(__dirname, '../test_files/true_cycle/doc2.dj');
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      const visited = new Set<string>();
      const stack = new Set<string>();
      const footnotes = new Map<string, string>();
  
      expect(() => {
        processFileInclusionsEntryPoint(filePath, fileContent, visited, stack, footnotes);
      }).toThrowError(/Infinite loop detected/);
    });
  });

  describe('processContent', () => {
    it('should process file inclusions correctly for false cycle', () => {
      const filePath = path.resolve(__dirname, '../test_files/false_cycle/doc2.dj');
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      const visited = new Set<string>();
      const stack = new Set<string>();
      const footnotes = new Map<string, string>();
  
      const result = processFileInclusionsEntryPoint(filePath, fileContent, visited, stack, footnotes);
  
      const expectedOutput = `This is the second test file.
  This is a test document.
  
  This is the third test file
  This is a test document.


  `;
  
      // Remove all whitespaces except for newline characters 
      //to avoid weird whitespace errors that do not matter
      //for what we're trying to test.
      const resultWithoutSpaces = result.replace(/ /g, '');
      const expectedOutputWithoutSpaces = expectedOutput.replace(/ /g, '');
  
      expect(resultWithoutSpaces).toEqual(expectedOutputWithoutSpaces);
    });
  });
