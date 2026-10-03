const pattern = function(patt : string) : RegExp {
  return new RegExp(patt, 'y');
}

const find = function(subject : string,
                      patt : RegExp,
                      startpos : number,
                      endpos ?: number) : null | { startpos : number,
                                                   endpos : number,
                                                   captures : string[] } {
  patt.lastIndex = startpos;
  let subj : string;
  if (endpos !== undefined) {
    subj = subject.substring(0, endpos + 1);
  } else {
    subj = subject;
  }
  const result = patt.exec(subj);
  if (result !== null) {
    const capts = [];
    for (let i = 1; i < result.length; i++) {
      capts.push(result[i]);
    }
    // The patterns are sticky, so a match begins exactly where the search
    // did and ends where exec left lastIndex.  Taking the bounds from
    // there rather than from a `d` flag's `indices` saves building an
    // array of index pairs for every match; the captures come straight
    // off the result instead of being cut out of the subject again.
    return { startpos: startpos,
             endpos: patt.lastIndex - 1,
             captures: capts };
  } else {
    return null;
  }
}

export { pattern, find };
