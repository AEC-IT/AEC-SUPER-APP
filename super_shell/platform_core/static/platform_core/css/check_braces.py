def check_braces(filepath):
    with open(filepath, 'r') as f:
        content = f.read()
    
    brace_count = 0
    line_num = 1
    col_num = 1
    
    for i, char in enumerate(content):
        if char == '\n':
            line_num += 1
            col_num = 1
        else:
            col_num += 1
            
        if char == '{':
            brace_count += 1
        elif char == '}':
            brace_count -= 1
            if brace_count < 0:
                print(f"Extra closing brace at line {line_num}, col {col_num}")
                return False
                
    if brace_count != 0:
        print(f"Unbalanced braces: {brace_count} unclosed braces remaining")
        return False
        
    print("Braces are perfectly balanced!")
    return True

check_braces('/Users/sethubibin/Desktop/AEC SUPER APP/super_shell/platform_core/static/platform_core/css/dashboard.css')
