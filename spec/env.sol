<%= imports %>

contract DappleEnvironment {

  struct Environment {
<%= signatures %>
  }
<%= environments_init %>

  function DappleEnvironment() {
<%= environment_spec %>
  }
}
